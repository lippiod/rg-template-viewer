'use strict'

let rTreeData, factionList, factionGroups, nawPageList, rchChange={};
let validText = [];
const jsonTree = 'data/rtree.json';
const jsonFactions = 'data/factions.json';
const jsonMisc = 'data/misc.json';
const nawRoot = 'notawiki';
const rDict = {
    'S': 'Spellcraft',
    'C': 'Craftsmanship',
    'D': 'Divine',
    'E': 'Economics',
    'A': 'Alchemy',
    'W': 'Warfare',
    'F': 'Forbidden'
}

const rps = (() => {
    let arr = [136];
    for(let i=17; i<100; i++) {
        arr.push(i + arr[i-17]);
    }
    return arr;
})();

function getAscension(r) {
    if(r<40)  return 0;
    if(r<100) return 1;
    if(r<160) return 2;
    return 3;
}

function inRange(r, section) {
    return r >= nawPageList[section].min && r <= nawPageList[section].max;
}

function getAbbr(faction, checkBase) {
    if(checkBase) {
        for(let f of factionGroups.base) {
            if(factionList[f].name.toLowerCase() == faction.toLowerCase())
                return f.abbr;
        }
    } else {
        for(let f in factionList) {
            if(factionList[f].name.toLowerCase() == faction.toLowerCase())
                return factionList[f].abbr;
        }
    }
    console.log(`Faction not found!! [${faction}]`);
    return "";
}

Vue.component('research', {
    props: ['cat', 'cost', 'id', 'req', 'change', 'rchTooltip', 'hasUB', 'hasUP', 'hasSP'],
    data() {
        return {
            checked: false
        }
    },

    computed: {
        show() {
            return this.cost <= this.$root.getRps &&
                   (!this.$root.hideResearch || this.available);
        },
        enabled() {
            let budgets = this.$root.researchSlots[this.cat];
            let cost = this.$root.researchSelected[this.cat].cost;
            if(!this.available && this.checked) {
                this.checked = !this.checked;
                this.$emit('res-change', this.id, this.checked, this.cat, this.cost);
                return false;
            }

            if(budgets == -1)
                return true;
            if(budgets < 3500 && budgets > cost)
                return true;
            if(budgets >= 3500 && budgets >= cost + this.cost)
                return true;
            if(getAscension(this.$root.rein) == 2 &&
               rTreeData[this.cat].find(e => e.id == this.id).free)
                return true;

            return false;
        },
        available() {
            let asc = getAscension(this.$root.rein);
            let f = factionList[this.$root.faction];
            if(this.$root.faction=="")
                return true;
            if(this.cost > this.$root.getRps)
                return false;
            if(f.abbr == 'MC' && (asc == 0 || asc == 1 && !inRange(this.$root.rein, 'R75Plus')))
                return false;
            if(this.req === undefined || this.req.length == 0)
                return true;

            if(f.abbr == 'MC') {
                let merc = this.$root.mercUpgrades;
                if (this.req[0] == '~MC' ||
                    this.req[0] == '~neutral' && merc.align[0] == 'neutral')
                    return false;
                if(factionGroups.aligns.hasOwnProperty(this.req[0]))
                    if(this.req[0] != merc.align[0] && this.req[0] != merc.align[1])
                        return false;
                if(this.req[this.req.length-1] == ':UB') {
                    let fr = factionList[this.req[0]];
                    if(!this.hasUB)
                        return false;
                    if(merc.align[0] != fr.align[0])
                        return false;
                    if(asc == 3 && fr.align[1].length && merc.align[1] != fr.align[1])
                        return false;
                }
                if(this.req[1] == ':SP') {
                    if(merc.lineage == this.req[0])
                        return true;
                    if(!this.hasSP)
                        return false;
                    if(!merc.spells.includes(`SP:${factionList[this.req[0]].spell}`))
                        return false;
                }
                if(this.req[1] == ':UP' && !this.hasUP)
                    return false;

                return true;
            }

            for(let req of this.req) {
                if(req[0] == ':') {
                    continue;
                } else if(req == 'MC') {
                    return false;
                } else if(req[0] == '~') {
                    if(req.slice[1] == 'neutral' && f.align[0] == 'neutral')
                        return false;
                } else if(factionGroups.base.includes(req)) {
                    if(req != f.abbr)
                        return false;
                } else if(factionGroups.prestige.includes(req)) {
                    if(!this.$root.prestige ||
                       factionList[req].align[0] != f.align[0])
                        return false;
                } else if(factionGroups.aligns.hasOwnProperty(req)) {
                    if(req != f.align[0] && req != f.align[1])
                        return false;
                } else {
                    console.log("unknwon req???");
                    console.log(req);
                }
            }
            return true;
        }
    },
    methods: {
        toggleResearch() {
            if(this.available && (!this.checked && this.enabled || this.checked)) {
                this.checked = !this.checked;
                this.$emit('res-change', this.id, this.checked, this.cat, this.cost);
            }
        }
    },
    watch: {
        change() {
            if(!this.change) return;

            let rchSelected = this.$root.researchSelected[this.cat].rch;
            this.checked = rchSelected.includes(this.id);
            if(this.checked && !this.available) {
                this.checked = !this.checked;
                console.log(`[${this.id}] not available!!`)
                this.$emit('res-change', this.id, this.checked, this.cat, this.cost);
            }
            this.$emit('change-done', this.id);
        }
    },
    template: '<div v-show="show" v-tooltip="{ content: rchTooltip, html: true }" :id="id" :class="[cat, {checked, enabled, available}]" @click="toggleResearch"><div class="background"></div><img src="img/OKSign.png" alt="V" class="sign ok-sign"><img src="img/NOSign.png" alt="X" class="sign no-sign"></div>'
});

const regA = /good|evil|neutral|order|chaos|balance/ig
const regF = /((MA:)?(FR|EL|AN|GB|UD|DM|TT|DD|FC|DN|DW|DG|AR|DJ|MK)(1[0-2]|[1-9])|UNN:(FR|EL|AN|GB|UD|DM|TT|DD|FC|DN|DW|DG|AR|DJ|MK))/i;
const regR = /[SCDEAWF][0-9]{1,4}/i;
let strU = '', strS = '', strFName = '';
let regU, regS, regFName;
$( document ).ready(function() {
    //$.ajaxSetup({ cache: false });
    $.getJSON(jsonMisc, function(data) {
        factionGroups = data.factionGroups;
        nawPageList = data.nawPageList;
        $.getJSON(jsonFactions, function(data) {
            factionList = data;
            $.each(data, function(key, val) {
                strFName += strFName.length==0 ? `(${val.name}` : `|${val.name}`;
                strU += strU.length==0 ? `UB:(${val.unique}` : `|${val.unique}`;
                strS += strS.length==0 ? `SP:(${val.spell}` : `|${val.spell}`;
            });
            strFName += ')';
            strU += ')';
            strS += ')';

            $.getJSON(jsonTree, function(data) {
                rTreeData = data;
                $.each(data, function(key, val) {
                    $.each(val, function(i, v) {
                        validText.push(v.id);
                        rchChange[v.id] = false;
                    });
                });
                regU = new RegExp(strU);
                regS = new RegExp(strS);
                regFName = new RegExp(strFName, 'ig');

                runApp();
            });
        });
    });
});

let vm;
function runApp() {
    vm = new Vue({
        el: "#template-viewer",
        data: {
            rein: 70,
            hideResearch: false,
            faction: '',
            prestige: false,
            elite: false,
            templateText: '',
            imported: 0,
            nawRchTree: {},
            nawSections: {},
            nawPage: '',
            nawBuildId: [],
            archonBlood: 'none',
            slotAdd: 1,
            hasBloodSpring: false,
            rchChange,
            researchSelected: {
                Spellcraft: { cost: 0, rch: [] },
                Craftsmanship: { cost: 0, rch: [] },
                Divine: { cost: 0, rch: [] },
                Economics: { cost: 0, rch: [] },
                Alchemy: { cost: 0, rch: [] },
                Warfare: { cost: 0, rch: [] },
                Forbidden: { cost: 0, rch: [] }
            },
            mercUpgrades: {
                tier: [[], [], [], []],
                unique: '',
                spells: [],
                lineage: '',
                union: '',
                ma: '',
                align: ['good', 'order'],
            },
            baseFactions: Object.values(factionList).filter(f => f.abbr == 'MC' || factionGroups.base.includes(f.abbr)),
            rTreeData,
            nawPageList
        },
        computed: {
            nawCategory() {
                if(!this.nawSections.hasOwnProperty(this.nawPage))
                    return [];

                return $( '.rgtv-category', this.nawSections[this.nawPage] ).map(function() {
                    let name = $( this ).children().first().text();
                    let buildList = $( '.rgtv-build', this ).map(function() {
                        return $( this ).children().first().text();
                    }).get();
                    return { name, buildList };
                });
            },
            nawBuild() {
                let category = $( '.rgtv-category', this.nawSections[this.nawPage] ).get(this.nawBuildId[0]);
                return $( '.rgtv-build', category ).get(this.nawBuildId[1]);
            },
            nawBuildHtml() {
                if(this.nawBuildId !== undefined && this.nawBuildId.length > 0) {
                    let desc = $( '.rgtv-desc', this.nawBuild ).html();
                    let temp = $( '.rgtv-template', this.nawBuild ).html();
                    let note = $( '.rgtv-notes', this.nawBuild ).html();
                    return (desc ? desc : '') + (temp ? temp : '') + (note ? note : '');
                }
                return '';
            },
            mercTrigger() {
                return {
                    hasUB: this.researchSelected.Economics.rch.includes('E3300'),
                    hasUP: this.mercUpgrades.tier[2].includes('EL8'),
                    hasSP: this.mercUpgrades.spells.length > 0
                }
            },
            pageUrl() {
                return `http://musicfamily.org/realm/${this.nawPage}`;
            },
            rMin() {
                return this.nawPage.length ? nawPageList[this.nawPage].min : 16;
            },
            rMax() {
                return this.nawPage.length ? nawPageList[this.nawPage].max : 190;
            },
            hasFlameHorn() {
                return this.faction != 'MC';
            },
            hasAncientDevice() {
                return this.faction != 'MC';
            },
            showTotal() {
                return getAscension(this.rein) != 3 && this.faction.length;
            },
            showA3() {
                return getAscension(this.rein) == 3;
            },
            budgets() {
                return this.rein >= 175 ? 6000 : 3500;
            },
            pointsUsed() {
                return Math.max(...Object.values(this.researchSelected).map(e => e.cost));
            },
            notOrder() {
                return !factionGroups.aligns.order.includes(this.faction);
            },
            requiredTime() {
                let pts = this.pointsUsed - this.budgets - 500;
                if(pts < 1)
                    return '';
                let sec = Math.ceil(Math.exp(Math.pow(10 * pts, 0.25)) - 1);
                let day = Math.floor(sec / 86400);
                let hour = Math.floor((sec - 86400 * day) / 3600);
                let minute = Math.floor((sec - 86400 * day - 3600 * hour) / 60);
                let second = Math.floor(sec - 86400 * day - 3600 * hour - 60 * minute);
                let timeStr = (day?`${day} days`:'') + (hour?` ${hour} hours`:'') + (minute?` ${minute} minutes`:'') + (second?` ${second} seconds`:'');
                return timeStr;
            },
            researchSlots() {
                let rss = {};
                for(let k in rDict)
                    rss[rDict[k]] = -1;
                if(this.faction=="")
                    return rss;

                let r = this.rein;
                let asc = getAscension(r);
                let slot = factionList[this.faction].slot;
                if(r<16)
                    return rss;
                if(asc < 2) {
                    let isNeutral = factionGroups.aligns.neutral.includes(this.faction);
                    let isGood = factionGroups.aligns.good.includes(this.faction);
                    for(let [key, val] of Object.entries(rDict)) {
                        rss[val] = key != 'F' ? 4 : 0;

                        if(r>=17 && key=='A') rss[val]++;
                        if(r>=19 && key=='C') rss[val]++;
                        if(r>=20 && key.match(/[SDEW]/)) rss[val]++;
                        if(r>=70 && key != 'F') rss[val]++;

                        if(r>=23 && slot.includes(key) && isNeutral && this.hasAncientDevice)
                            rss[val]++;
                        if(r>=29 && !isNeutral && this.prestige && this.hasFlameHorn) {
                            if(slot.includes(key))
                                rss[val]++;
                            if(isGood && key=="C")
                                rss['Craftsmanship'] += 2;
                            else if(!isGood && key=="W")
                                rss['Warfare'] += 2;
                        }
                    }
                    return rss;
                }
                if(asc == 2) {
                    for(let [key, val] of Object.entries(rDict)) {
                        rss[val] = key != 'F' ? 1 : 0;
                        if(this.archonBlood == 'bloodline')
                            rss[val] += this.slotAdd;
                        if(this.archonBlood == 'A400' && this.hasBloodSpring && !this.notOrder && this.elite)
                            rss[val] += this.slotAdd;
                    }
                    return rss;
                }
                for(let k in rDict)
                    rss[rDict[k]] = -1;
                return rss;
            },
            colorSelected() {
                if(this.faction=="")
                    return "";
                return factionList[this.faction].color;
            },
            getRps() {
                let r = this.rein;
                if(r<16)
                    return 0;
                else if(getAscension(r) < 2)
                    return rps[r-16];
                else if(r<175)
                    return 5000;
                else if(r<190)
                    return 5000 + 125 * (r-174);
                else
                    return 7000;
            }
        },
        methods: {
            clearBtn(cmd) {
                if(cmd == 'string') {
                    this.templateText = '';
                }
                else {
                    for(let rKey in this.researchSelected) {
                        for(let rch of this.researchSelected[rKey].rch) {
                            this.rchChange[rch] = true;
                        }
                        this.researchSelected[rKey].cost = 0;
                        this.researchSelected[rKey].rch = [];
                    }
                    let align = this.mercUpgrades.align;
                    this.mercUpgrades = {
                        tier: [[], [], [], []],
                        unique: '',
                        spells: [],
                        lineage: '',
                        union: '',
                        ma: '',
                        align
                    };
                }
            },
            exportBtn(cmd) {
                let denseStr = '';
                let merc = this.mercUpgrades;
                for(let i of merc.tier) {
                    for (let j of i) {
                        denseStr += `,${j}`;
                    }
                }
                if(merc.ma.length)
                    denseStr += `,${merc.ma}`;
                for(let i of merc.spells)
                    denseStr += `,${i}`;
                if(merc.unique.length)
                    denseStr += `,${merc.unique}`;
                if(merc.union.length)
                    denseStr += `,${merc.union}`;
                for(let cat in this.researchSelected) {
                    for(let rch of this.researchSelected[cat].rch)
                        denseStr += `,${rch}`;
                }
                this.templateText = denseStr.slice(1);
            },
            importBtn(isHuman) {
                let tempText = this.templateText;
                let res = tempText.split(",").map(str => str.trim());
                let asc = getAscension(this.rein);
                let merc = this.mercUpgrades;
                let buildStr = isHuman ? '' : ` on /${this.nawPage}/: ${this.nawCategory[this.nawBuildId[0]].buildList[this.nawBuildId[1]]}`;

                for(let s of res) {
                    if(regF.test(s)) {
                        //console.log(`Faction upgrade [${s}]`);
                        s = s.match(regF)[0].toUpperCase();
                        if(s.match(/^MA:/))
                            merc.ma = s;
                        else if(s.match(/^UNN:/))
                            merc.union = s;
                        else {
                            let n = Math.floor((parseInt(s.slice(2))-1) / 3);
                            if(merc.tier[n].length < 4)
                                merc.tier[n].push(s);
                        }
                    } else if(regS.test(s)) {
                        //console.log(`Faction spell [${s}]`);
                        if(merc.spells.length<2)
                            merc.spells.push(s.match(regS)[0]);
                    } else if(regU.test(s)) {
                        //console.log(`Unique building [${s}]`);
                        merc.unique = s.match(regU)[0];
                    } else if(regR.test(s)) {
                        s = s.toUpperCase();
                        if(validText.includes(s)) {
                            //console.log(`Research [${s}]`);
                            let cat = rDict[s[0]];
                            let rch = rTreeData[cat].find(e => e.id == s);
                            let rs = this.researchSelected[cat];
                            let budgets = this.researchSlots[cat];
                            if(rch) {
                                if(rs.rch.includes(rch.id))
                                    continue;

                                let change = false;
                                if(budgets == -1) {
                                    change = true;
                                } else if(asc < 2) {
                                    if(budgets > rs.cost)
                                        change = true;
                                } else if(asc == 2) {
                                    if(rch.free || budgets > rs.cost)
                                        change = true;
                                } else {
                                    if(budgets >= rs.cost + rch.cost)
                                        change = true;
                                }
                                if(change)
                                    this.resChange(rch.id, true, cat, rch.cost);
                            } else {
                                console.log(`????? [${s}]`);
                            }
                        } else {
                            console.log(`No matching research!! [${s}] ${buildStr}`);
                        }
                    } else {
                        console.log(`No matching string!! [${s}] ${buildStr}`);
                    }
                }
                if(!isHuman)
                    this.exportBtn();
            },
            resChange(rId, checked, cat, cost) {
                let rs = this.researchSlots[cat];
                let rSel = this.researchSelected[cat];
                let asc = getAscension(this.rein);
                if(checked) {
                    if(asc < 2) {
                        rSel.cost++;
                        rSel.rch.push(rId);
                    } else if(asc == 2) {
                        let rch = rTreeData[cat].find(e => e.id == rId);
                        rSel.rch.push(rId);
                        if(!rch.free)
                            rSel.cost++;
                    } else {
                        let rch = rTreeData[cat].find(e => e.id == rId);
                        rSel.cost += cost;
                        rSel.rch.push(rId);
                    }
                } else {
                    rSel.rch.splice(rSel.rch.indexOf(rId),1);
                    if(asc < 2) {
                        rSel.cost--;
                    } else if(asc == 2) {
                        if(!rTreeData[cat].find(e => e.id == rId).free)
                            rSel.cost--;
                    } else {
                        rSel.cost -= cost;
                    }
                }
                if(rId == 'A400')
                    this.hasBloodSpring = checked;
                this.rchChange[rId] = true;
            },
            changeDone(rId) {
                if(this.rchChange[rId])
                    this.rchChange[rId] = false;
                else
                    console.log("WHY????!!!!!");
            }
        },
        watch: {
            rein(newR, oldR) {
                let newA = getAscension(newR);
                let oldA = getAscension(oldR);
                if(newA == oldA) {
                    if(newR < this.rMin)
                        this.rein = this.rMin;
                    if(newR > this.rMax)
                        this.rein = this.rMax;
                    if(this.imported > 0)
                        this.imported--;
                    return;
                }
                if(oldA == 2)
                    $( "option.color-mc" ).prop('disabled', false);
                if(newA == 2) {
                    $( "option.color-mc" ).prop('disabled', true);
                    if(this.faction == 'MC') {
                        this.faction = '';
                        return;
                    }
                }
                if(this.imported > 0) {
                    this.imported--;
                } else {
                    this.nawPage = '';
                    this.clearBtn('select');
                }
            },
            faction() {
                if(this.imported > 0)
                    this.imported--;
                else
                    this.clearBtn('select');
            },
            elite() {
                if(this.elite)
                    this.prestige = true;
            },
            prestige() {
                if(!this.prestige)
                    this.elite = false;
            },
            nawPage() {
                this.nawBuildId = [];
            },
            nawBuildId() {
                this.imported = 0;
                if(this.nawBuildId !== undefined && this.nawBuildId.length > 0) {
                    this.clearBtn('select');
                    let rein = nawPageList[this.nawPage].max;
                    if(this.rein != rein) {
                        this.imported++;
                        this.rein = rein;
                    }
                    $( '.rgtv-desc', this.nawBuild ).children().each((ind, val) => {
                        if($( val ).has( "b" ).length) {
                            let k = $( "b", val ).text();
                            let v = $( val ).contents().filter(function(){ 
                                return this.nodeType == 3;
                            }).text().replace(/:/, '').trim();

                            if(k.match(/faction/i)) {
                                let f = v.match(regFName);
                                //console.log(f);
                                if(this.faction != getAbbr(f[0]))
                                    this.imported++;
                                if(f[0].match(/mercenary/i)) {
                                    let a = v.match(regA);
                                    this.faction = 'MC';
                                    this.mercUpgrades.align[0] = a[0].toLowerCase();
                                    if(a.length > 1) {
                                        this.mercUpgrades.align[1] = a[1].toLowerCase();
                                    }
                                } else {
                                    this.faction = getAbbr(f[0]);
                                    let p = nawPageList[this.nawPage].prestige;
                                    let a = this.nawPage=='R40-R46';
                                    let n = factionGroups.aligns.neutral.includes(this.faction);
                                    this.prestige = !a && p || a && !n;
                                    this.elite = this.rein >= 130;
                                    if(factionGroups.aligns.order.includes(this.faction) && this.elite)
                                        this.archonBlood = 'A400';
                                }
                            } else if(k.match(/bloodline/i)) {
                                if(v.match(regFName)) {
                                    if(this.rein>=130 && this.rein<160 && v.match(/archon/i))
                                        this.archonBlood = 'bloodline';
                                    if(this.faction=='MC' && this.rein >= 60)
                                        this.mercUpgrades.lineage = getAbbr(v.match(regFName)[0]);
                                }
                            }
                        }
                    });
                    this.templateText = $( '.rgtv-template', this.nawBuild ).text();
                    this.importBtn(false);
                }
            },
            researchSlots: {
                deep: true,
                handler() {
                    for(let key in this.researchSlots) {
                        let budgets = this.researchSlots[key];
                        let rs = this.researchSelected[key];
                        let asc = getAscension(this.rein);
                        while(budgets > -1 && budgets < rs.cost) {
                            let rch = rs.rch.pop();
                            if(asc < 2)
                                rs.cost--;
                            else if(asc == 2)
                                if(!rTreeData[rDict[rch[0]]].find(e => e.id == rch).free)
                                    rs.cost--;
                            else
                                rs.cost -= parseInt(rch.slice(1));
                        }
                    }
                }
            }
        }
    });
    let secList = $( "#naw-section>option" ).map(function() { return $( this ).val() });

    for(let s of secList) {
        $.get(`${nawRoot}/${s}/index.php`, data => {
            let html = $.parseHTML( data );
            vm.nawSections[s] = html;
        });
    }
    $.get(`${nawRoot}/Researchtree/index.php`, data => {
        let html = $.parseHTML( data );
        let rchTree = $( 'area', html ).filter(function() {
             return $( this ).attr( "research" ).match(regR);
        }).map(function () {
            let rch = $( this ).attr( "research" ).match(regR)[0];
            if(validText.includes(rch)) {
                return { name: rch, str: $( this ).attr( "research" )};
            }
        }).get();
        let nawRchTree = {};
        for(let r of rchTree) {
            nawRchTree[r.name] = r.str;
        }
        vm.nawRchTree = nawRchTree;
    });
}
