// ==UserScript==
// @name         MWI Advisor
// @namespace    local.mwi-combat-advisor
// @version      0.77.0
// @description  Advice for Milky Way Idle: where to fight and what to buy (simulating your own character), what to make, levelling, teas and market prices.
// @match        https://www.milkywayidle.com/*
// @match        https://test.milkywayidle.com/*
// @match        https://www.milkywayidlecn.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/tarzanz/mwi-combat-advisor
// @downloadURL  https://raw.githubusercontent.com/tarzanz/mwi-combat-advisor/main/dist/mwi-combat-advisor.user.js
// @updateURL    https://raw.githubusercontent.com/tarzanz/mwi-combat-advisor/main/dist/mwi-combat-advisor.user.js
// ==/UserScript==

// Combat engine: MWICombatSimulator by AmVoidGuy / shykai (MIT licence),
// https://github.com/shykai/MWICombatSimulatorTest. Licences at the end of this file.

(() => {
  // virtual:worker-source
  var worker_source_default = '(()=>{var ma=Object.defineProperty;var ua=(n,t,e)=>t in n?ma(n,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):n[t]=e;var p=(n,t,e)=>ua(n,typeof t!="symbol"?t+"":t,e);var pa=new Set(["enhancementLevelTotalBonusMultiplierTable","abilitySlotsLevelRequirementList"]),Ft=globalThis.__MWIA_DATA||(globalThis.__MWIA_DATA={});function S(n){return Ft[n]||(Ft[n]=pa.has(n)?[]:{}),Ft[n]}function Ie(n){for(let[t,e]of Object.entries(n)){let a=S(t);if(Array.isArray(a))a.length=0,a.push(...e);else{for(let i of Object.keys(a))delete a[i];Object.assign(a,e)}}}var Ut=class n{static getTarget(t){return t?t.find(a=>a.combatDetails.currentHitpoints>0)??null:null}static randomInt(t,e){if(e<t){let f=t;t=e,e=f}let a=Math.ceil(t),i=Math.floor(e);if(Math.floor(t)==i)return Math.floor((t+e)/2+Math.random());let s=-1*(t-a),r=e-i,o=2*s+(i-a),c=(i+a)/2,l=(e+t)/2,h=o*(l-c)/(i+1-l),m=Math.abs(h/(h+o));return Math.random()<m?r>s?Math.floor(i+1):Math.floor(a-1):r>s?Math.floor(t+Math.random()*(i+s-t+1)):Math.floor(a-r+Math.random()*(e-(a-r)+1))}static processAttack(t,e,a=null){let i=a?a.combatStyleHrid:t.combatDetails.combatStats.combatStyleHrid,s=a?a.damageType:t.combatDetails.combatStats.damageType,r=1,o=1,c=1;switch(i){case"/combat_styles/stab":r=t.combatDetails.stabAccuracyRating,o=t.combatDetails.stabMaxDamage,c=e.combatDetails.stabEvasionRating;break;case"/combat_styles/slash":r=t.combatDetails.slashAccuracyRating,o=t.combatDetails.slashMaxDamage,c=e.combatDetails.slashEvasionRating;break;case"/combat_styles/smash":r=t.combatDetails.smashAccuracyRating,o=t.combatDetails.smashMaxDamage,c=e.combatDetails.smashEvasionRating;break;case"/combat_styles/ranged":r=t.combatDetails.rangedAccuracyRating,o=t.combatDetails.rangedMaxDamage,c=e.combatDetails.rangedEvasionRating;break;case"/combat_styles/magic":r=t.combatDetails.magicAccuracyRating,o=t.combatDetails.magicMaxDamage,c=e.combatDetails.magicEvasionRating;break;default:throw new Error("Unknown combat style: "+i)}let l=1,h=0,m=0,f=0,u=0,g=0,b;switch(s){case"/damage_types/physical":l=1+t.combatDetails.combatStats.physicalAmplify,h=t.combatDetails.totalArmor,m=t.combatDetails.combatStats.armorPenetration,f=e.combatDetails.totalArmor,u=e.combatDetails.combatStats.physicalThorns,g=e.combatDetails.combatStats.armorPenetration,b="physicalThorns";break;case"/damage_types/water":l=1+t.combatDetails.combatStats.waterAmplify,h=t.combatDetails.totalWaterResistance,m=t.combatDetails.combatStats.waterPenetration,f=e.combatDetails.totalWaterResistance,u=e.combatDetails.combatStats.elementalThorns,g=e.combatDetails.combatStats.waterPenetration,b="elementalThorns";break;case"/damage_types/nature":l=1+t.combatDetails.combatStats.natureAmplify,h=t.combatDetails.totalNatureResistance,m=t.combatDetails.combatStats.naturePenetration,f=e.combatDetails.totalNatureResistance,u=e.combatDetails.combatStats.elementalThorns,g=e.combatDetails.combatStats.naturePenetration,b="elementalThorns";break;case"/damage_types/fire":l=1+t.combatDetails.combatStats.fireAmplify,h=t.combatDetails.totalFireResistance,m=t.combatDetails.combatStats.firePenetration,f=e.combatDetails.totalFireResistance,u=e.combatDetails.combatStats.elementalThorns,g=e.combatDetails.combatStats.firePenetration,b="elementalThorns";break;default:throw new Error("Unknown damage type: "+s)}let T=1,z=0,pt=!1,ft=t.combatDetails.combatStats.criticalRate,dt=t.combatDetails.combatStats.criticalDamage;a&&(r*=1+a.bonusAccuracyRatio),t.isWeakened&&(r=r-t.weakenPercentage*r),T=Math.pow(r,1.4)/(Math.pow(r,1.4)+Math.pow(c,1.4)),i=="/combat_styles/ranged"&&(z=.3*T),z=z+ft;let at=a?a.damageFlat:0,bt=a?a.damageRatio:1,it=a?a.armorDamageRatio*t.combatDetails.totalArmor:0,G=l*(1+at+it),I=l*(bt*o+at+it);Math.random()<z&&(I=I*(1+dt),G=I,pt=!0);let d=n.randomInt(G,I);d*=1+t.combatDetails.combatStats.taskDamage,d*=1+e.combatDetails.combatStats.damageTaken,a?d*=1+t.combatDetails.combatStats.abilityDamage:d+=d*t.combatDetails.combatStats.autoAttackDamage;let R=0,P=0,N=!1;if(Math.random()<T){N=!0;let H=f;m>0&&f>0&&(H=f/(1+m));let B=100/(100+H);H<0&&(B=(100-H)/100);let K=Math.ceil(B*d);R=Math.min(K,e.combatDetails.currentHitpoints),e.combatDetails.currentHitpoints-=R}if(u>0&&f>-99){let H=h;h>0&&(H=h/(1+g));let B=100/(100+H);H<0&&(B=(100-H)/100);let K=1+e.combatDetails.combatStats.taskDamage,Nt=1+t.combatDetails.combatStats.damageTaken,qt=K*Nt,gt=n.randomInt(1,qt*e.combatDetails.defensiveMaxDamage*(1+f/100)*u),V=Math.ceil(B*gt);P=Math.min(V,t.combatDetails.currentHitpoints),t.combatDetails.currentHitpoints-=P}let Pt=0;if(e.combatDetails.combatStats.retaliation>0&&Math.pow(e.combatDetails.smashAccuracyRating,1.4)/(Math.pow(e.combatDetails.smashAccuracyRating,1.4)+Math.pow(t.combatDetails.smashEvasionRating,1.4))>Math.random()){let B=t.combatDetails.totalArmor;B>0&&(B=B/(1+e.combatDetails.combatStats.armorPenetration));let K=100/(100+B);B<0&&(K=(100-B)/100);let Nt=1+e.combatDetails.combatStats.taskDamage,qt=1+t.combatDetails.combatStats.damageTaken,gt=Nt*qt,V=d;V=Math.min(V,e.combatDetails.defensiveMaxDamage*5);let oa=gt*e.combatDetails.combatStats.retaliation*V,la=gt*e.combatDetails.combatStats.retaliation*(e.combatDetails.defensiveMaxDamage+V),ca=n.randomInt(oa,la),ha=Math.ceil(K*ca);Pt=Math.min(ha,t.combatDetails.currentHitpoints),t.combatDetails.currentHitpoints-=Pt}let Ce=0;!a&&N&&t.combatDetails.combatStats.lifeSteal>0&&(Ce=t.addHitpoints(Math.floor(t.combatDetails.combatStats.lifeSteal*R)));let Le=0;if(a&&N&&a.hpDrainRatio>0){let H=1+t.combatDetails.combatStats.healingAmplify;Le=t.addHitpoints(Math.floor(a.hpDrainRatio*R*H))}let Oe=0;return!a&&N&&t.combatDetails.combatStats.manaLeech>0&&(Oe=t.addManapoints(Math.floor(t.combatDetails.combatStats.manaLeech*R))),{damageDone:R,didHit:N,thornDamageDone:P,thornType:b,retaliationDamageDone:Pt,lifeStealHeal:Ce,hpDrain:Le,manaLeechMana:Oe,isCrit:pt}}static processHeal(t,e,a){if(e.combatStyleHrid!="/combat_styles/magic")throw new Error("Heal ability effect not supported for combat style: "+e.combatStyleHrid);let i=1+t.combatDetails.combatStats.healingAmplify,s=t.combatDetails.magicMaxDamage,r=e.damageFlat,o=e.damageRatio,c=i*(1+r),l=i*(o*s+r),h=this.randomInt(c,l);return a.addHitpoints(h)}static processRevive(t,e,a){if(e.combatStyleHrid!="/combat_styles/magic")throw new Error("Heal ability effect not supported for combat style: "+e.combatStyleHrid);let i=1+t.combatDetails.combatStats.healingAmplify,s=t.combatDetails.magicMaxDamage,r=e.damageFlat,o=e.damageRatio,c=i*(1+r),l=i*(o*s+r),h=this.randomInt(c,l),m=a.addHitpoints(h);return a.combatDetails.currentManapoints=a.combatDetails.maxManapoints,a.clearCCs(),m}static processSpendHp(t,e){let a=t.combatDetails.currentHitpoints,i=e.spendHpRatio,s=Math.floor(a*i);return t.combatDetails.currentHitpoints-=s,s}static calculateTickValue(t,e,a){let i=Math.floor(a*t/e),s=Math.floor((a-1)*t/e);return i-s}},_=Ut;var Qt=class{constructor(t,e){this.type=t,this.time=e}},y=Qt;var yt=class yt extends y{constructor(t,e){super(yt.type,t),this.source=e}};p(yt,"type","autoAttack");var zt=yt,k=zt;var Dt=class Dt extends y{constructor(t,e,a,i,s,r,o){super(Dt.type,t),this.sourceRef=e,this.target=a,this.damage=i,this.totalTicks=s,this.currentTick=r,this.combatStyleHrid=o}};p(Dt,"type","damageOverTime");var Wt=Dt,st=Wt;var vt=class vt extends y{constructor(t,e){super(vt.type,t),this.source=e}};p(vt,"type","checkBuffExpiration");var Gt=vt,j=Gt;var Tt=class Tt extends y{constructor(t){super(Tt.type,t)}};p(Tt,"type","combatStart");var Kt=Tt,rt=Kt;var St=class St extends y{constructor(t,e,a,i,s){super(St.type,t),this.source=e,this.consumable=a,this.totalTicks=i,this.currentTick=s}};p(St,"type","consumableTick");var Vt=St,nt=Vt;var At=class At extends y{constructor(t){super(At.type,t)}};p(At,"type","cooldownReady");var jt=At,Zt=jt;var _t=class _t extends y{constructor(t){super(_t.type,t)}};p(_t,"type","enemyRespawn");var Yt=_t,$t=Yt;var v=function(n,t,e,a){function i(s){return s instanceof e?s:new e(function(r){r(s)})}return new(e||(e=Promise))(function(s,r){function o(h){try{l(a.next(h))}catch(m){r(m)}}function c(h){try{l(a.throw(h))}catch(m){r(m)}}function l(h){h.done?s(h.value):i(h.value).then(o,c)}l((a=a.apply(n,t||[])).next())})},D=function(n,t){var e={label:0,sent:function(){if(s[0]&1)throw s[1];return s[1]},trys:[],ops:[]},a,i,s,r=Object.create((typeof Iterator=="function"?Iterator:Object).prototype);return r.next=o(0),r.throw=o(1),r.return=o(2),typeof Symbol=="function"&&(r[Symbol.iterator]=function(){return this}),r;function o(l){return function(h){return c([l,h])}}function c(l){if(a)throw new TypeError("Generator is already executing.");for(;r&&(r=0,l[0]&&(e=0)),e;)try{if(a=1,i&&(s=l[0]&2?i.return:l[0]?i.throw||((s=i.return)&&s.call(i),0):i.next)&&!(s=s.call(i,l[1])).done)return s;switch(i=0,s&&(l=[l[0]&2,s.value]),l[0]){case 0:case 1:s=l;break;case 4:return e.label++,{value:l[1],done:!1};case 5:e.label++,i=l[1],l=[0];continue;case 7:l=e.ops.pop(),e.trys.pop();continue;default:if(s=e.trys,!(s=s.length>0&&s[s.length-1])&&(l[0]===6||l[0]===2)){e=0;continue}if(l[0]===3&&(!s||l[1]>s[0]&&l[1]<s[3])){e.label=l[1];break}if(l[0]===6&&e.label<s[1]){e.label=s[1],s=l;break}if(s&&e.label<s[2]){e.label=s[2],e.ops.push(l);break}s[2]&&e.ops.pop(),e.trys.pop();continue}l=t.call(n,e)}catch(h){l=[6,h],i=0}finally{a=s=0}if(l[0]&5)throw l[1];return{value:l[0]?l[1]:void 0,done:!0}}},x=function(n,t){var e=typeof Symbol=="function"&&n[Symbol.iterator];if(!e)return n;var a=e.call(n),i,s=[],r;try{for(;(t===void 0||t-- >0)&&!(i=a.next()).done;)s.push(i.value)}catch(o){r={error:o}}finally{try{i&&!i.done&&(e=a.return)&&e.call(a)}finally{if(r)throw r.error}}return s},M=function(n,t,e){if(e||arguments.length===2)for(var a=0,i=t.length,s;a<i;a++)(s||!(a in t))&&(s||(s=Array.prototype.slice.call(t,0,a)),s[a]=t[a]);return n.concat(s||Array.prototype.slice.call(t))},Pe=function(n){var t=typeof Symbol=="function"&&Symbol.iterator,e=t&&n[t],a=0;if(e)return e.call(n);if(n&&typeof n.length=="number")return{next:function(){return n&&a>=n.length&&(n=void 0),{value:n&&n[a++],done:!n}}};throw new TypeError(t?"Object is not iterable.":"Symbol.iterator is not defined.")},ja=(function(){function n(t){t===void 0&&(t=n.minComparator);var e=this;this.compare=t,this.heapArray=[],this._limit=0,this.offer=this.add,this.element=this.peek,this.poll=this.pop,this._invertedCompare=function(a,i){return e.compare(a,i).then(function(s){return-1*s})}}return n.getChildrenIndexOf=function(t){return[t*2+1,t*2+2]},n.getParentIndexOf=function(t){if(t<=0)return-1;var e=t%2?1:2;return Math.floor((t-e)/2)},n.getSiblingIndexOf=function(t){if(t<=0)return-1;var e=t%2?1:-1;return t+e},n.minComparator=function(t,e){return v(this,void 0,void 0,function(){return D(this,function(a){return t>e?[2,1]:t<e?[2,-1]:[2,0]})})},n.maxComparator=function(t,e){return v(this,void 0,void 0,function(){return D(this,function(a){return e>t?[2,1]:e<t?[2,-1]:[2,0]})})},n.minComparatorNumber=function(t,e){return v(this,void 0,void 0,function(){return D(this,function(a){return[2,t-e]})})},n.maxComparatorNumber=function(t,e){return v(this,void 0,void 0,function(){return D(this,function(a){return[2,e-t]})})},n.defaultIsEqual=function(t,e){return v(this,void 0,void 0,function(){return D(this,function(a){return[2,t===e]})})},n.print=function(t){function e(h){var m=n.getParentIndexOf(h);return Math.floor(Math.log2(m+1))}function a(h,m){for(var f="";m>0;--m)f+=h;return f}for(var i=0,s=[],r=e(t.length-1)+2,o=0;i<t.length;){var c=e(i)+1;i===0&&(c=0);var l=String(t.get(i));l.length>o&&(o=l.length),s[c]=s[c]||[],s[c].push(l),i+=1}return s.map(function(h,m){var f=Math.pow(2,r-m)-1;return a(" ",Math.floor(f/2)*o)+h.map(function(u){var g=(o-u.length)/2;return a(" ",Math.ceil(g))+u+a(" ",Math.floor(g))}).join(a(" ",f*o))}).join(`\n`)},n.heapify=function(t,e){return v(this,void 0,void 0,function(){var a;return D(this,function(i){switch(i.label){case 0:return a=new n(e),a.heapArray=t,[4,a.init()];case 1:return i.sent(),[2,a]}})})},n.heappop=function(t,e){var a=new n(e);return a.heapArray=t,a.pop()},n.heappush=function(t,e,a){return v(this,void 0,void 0,function(){var i;return D(this,function(s){switch(s.label){case 0:return i=new n(a),i.heapArray=t,[4,i.push(e)];case 1:return s.sent(),[2]}})})},n.heappushpop=function(t,e,a){var i=new n(a);return i.heapArray=t,i.pushpop(e)},n.heapreplace=function(t,e,a){var i=new n(a);return i.heapArray=t,i.replace(e)},n.heaptop=function(t,e,a){e===void 0&&(e=1);var i=new n(a);return i.heapArray=t,i.top(e)},n.heapbottom=function(t,e,a){e===void 0&&(e=1);var i=new n(a);return i.heapArray=t,i.bottom(e)},n.nlargest=function(t,e,a){return v(this,void 0,void 0,function(){var i;return D(this,function(s){switch(s.label){case 0:return i=new n(a),i.heapArray=M([],x(e),!1),[4,i.init()];case 1:return s.sent(),[2,i.top(t)]}})})},n.nsmallest=function(t,e,a){return v(this,void 0,void 0,function(){var i;return D(this,function(s){switch(s.label){case 0:return i=new n(a),i.heapArray=M([],x(e),!1),[4,i.init()];case 1:return s.sent(),[2,i.bottom(t)]}})})},n.prototype.add=function(t){return v(this,void 0,void 0,function(){return D(this,function(e){switch(e.label){case 0:return[4,this._sortNodeUp(this.heapArray.push(t)-1)];case 1:return e.sent(),this._applyLimit(),[2,!0]}})})},n.prototype.addAll=function(t){return v(this,void 0,void 0,function(){var e,a,i;return D(this,function(s){switch(s.label){case 0:e=this.length,(i=this.heapArray).push.apply(i,M([],x(t),!1)),a=this.length,s.label=1;case 1:return e<a?[4,this._sortNodeUp(e)]:[3,4];case 2:s.sent(),s.label=3;case 3:return++e,[3,1];case 4:return this._applyLimit(),[2,!0]}})})},n.prototype.bottom=function(){return v(this,arguments,void 0,function(t){return t===void 0&&(t=1),D(this,function(e){return this.heapArray.length===0||t<=0?[2,[]]:this.heapArray.length===1?[2,[this.heapArray[0]]]:t>=this.heapArray.length?[2,M([],x(this.heapArray),!1)]:[2,this._bottomN_push(~~t)]})})},n.prototype.check=function(){return v(this,void 0,void 0,function(){var t,e,a,i,s,r,o,c,l;return D(this,function(h){switch(h.label){case 0:t=0,h.label=1;case 1:if(!(t<this.heapArray.length))return[3,10];e=this.heapArray[t],a=this.getChildrenOf(t),h.label=2;case 2:h.trys.push([2,7,8,9]),i=(c=void 0,Pe(a)),s=i.next(),h.label=3;case 3:return s.done?[3,6]:(r=s.value,[4,this.compare(e,r)]);case 4:if(h.sent()>0)return[2,e];h.label=5;case 5:return s=i.next(),[3,3];case 6:return[3,9];case 7:return o=h.sent(),c={error:o},[3,9];case 8:try{s&&!s.done&&(l=i.return)&&l.call(i)}finally{if(c)throw c.error}return[7];case 9:return++t,[3,1];case 10:return[2]}})})},n.prototype.clear=function(){this.heapArray=[]},n.prototype.clone=function(){var t=new n(this.comparator());return t.heapArray=this.toArray(),t._limit=this._limit,t},n.prototype.comparator=function(){return this.compare},n.prototype.contains=function(t){return v(this,arguments,void 0,function(e,a){var i,s,r,o,c,l;return a===void 0&&(a=n.defaultIsEqual),D(this,function(h){switch(h.label){case 0:h.trys.push([0,5,6,7]),i=Pe(this.heapArray),s=i.next(),h.label=1;case 1:return s.done?[3,4]:(r=s.value,[4,a(r,e)]);case 2:if(h.sent())return[2,!0];h.label=3;case 3:return s=i.next(),[3,1];case 4:return[3,7];case 5:return o=h.sent(),c={error:o},[3,7];case 6:try{s&&!s.done&&(l=i.return)&&l.call(i)}finally{if(c)throw c.error}return[7];case 7:return[2,!1]}})})},n.prototype.init=function(t){return v(this,void 0,void 0,function(){var e;return D(this,function(a){switch(a.label){case 0:t&&(this.heapArray=M([],x(t),!1)),e=Math.floor(this.heapArray.length),a.label=1;case 1:return e>=0?[4,this._sortNodeDown(e)]:[3,4];case 2:a.sent(),a.label=3;case 3:return--e,[3,1];case 4:return this._applyLimit(),[2]}})})},n.prototype.isEmpty=function(){return this.length===0},n.prototype.leafs=function(){if(this.heapArray.length===0)return[];var t=n.getParentIndexOf(this.heapArray.length-1);return this.heapArray.slice(t+1)},Object.defineProperty(n.prototype,"length",{get:function(){return this.heapArray.length},enumerable:!1,configurable:!0}),Object.defineProperty(n.prototype,"limit",{get:function(){return this._limit},set:function(t){this._limit=~~t,this._applyLimit()},enumerable:!1,configurable:!0}),n.prototype.peek=function(){return this.heapArray[0]},n.prototype.pop=function(){return v(this,void 0,void 0,function(){var t;return D(this,function(e){return t=this.heapArray.pop(),this.length>0&&t!==void 0?[2,this.replace(t)]:[2,t]})})},n.prototype.push=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];return v(this,void 0,void 0,function(){return D(this,function(a){return t.length<1?[2,!1]:t.length===1?[2,this.add(t[0])]:[2,this.addAll(t)]})})},n.prototype.pushpop=function(t){return v(this,void 0,void 0,function(){var e;return D(this,function(a){switch(a.label){case 0:return[4,this.compare(this.heapArray[0],t)];case 1:return a.sent()<0?(e=x([this.heapArray[0],t],2),t=e[0],this.heapArray[0]=e[1],[4,this._sortNodeDown(0)]):[3,3];case 2:a.sent(),a.label=3;case 3:return[2,t]}})})},n.prototype.remove=function(t){return v(this,arguments,void 0,function(e,a){var i,s,r,o=this;return a===void 0&&(a=n.defaultIsEqual),D(this,function(c){switch(c.label){case 0:return this.heapArray.length?e!==void 0?[3,2]:[4,this.pop()]:[2,!1];case 1:return c.sent(),[2,!0];case 2:i=[0],c.label=3;case 3:return i.length?(s=i.shift(),[4,a(this.heapArray[s],e)]):[3,13];case 4:return c.sent()?s!==0?[3,6]:[4,this.pop()]:[3,11];case 5:return c.sent(),[3,10];case 6:return s!==this.heapArray.length-1?[3,7]:(this.heapArray.pop(),[3,10]);case 7:return this.heapArray.splice(s,1,this.heapArray.pop()),[4,this._sortNodeUp(s)];case 8:return c.sent(),[4,this._sortNodeDown(s)];case 9:c.sent(),c.label=10;case 10:return[2,!0];case 11:r=n.getChildrenIndexOf(s).filter(function(l){return l<o.heapArray.length}),i.push.apply(i,M([],x(r),!1)),c.label=12;case 12:return[3,3];case 13:return[2,!1]}})})},n.prototype.replace=function(t){return v(this,void 0,void 0,function(){var e;return D(this,function(a){switch(a.label){case 0:return e=this.heapArray[0],this.heapArray[0]=t,[4,this._sortNodeDown(0)];case 1:return a.sent(),[2,e]}})})},n.prototype.size=function(){return this.length},n.prototype.top=function(){return v(this,arguments,void 0,function(t){return t===void 0&&(t=1),D(this,function(e){return this.heapArray.length===0||t<=0?[2,[]]:this.heapArray.length===1||t===1?[2,[this.heapArray[0]]]:t>=this.heapArray.length?[2,M([],x(this.heapArray),!1)]:[2,this._topN_push(~~t)]})})},n.prototype.toArray=function(){return M([],x(this.heapArray),!1)},n.prototype.toString=function(){return this.heapArray.toString()},n.prototype.get=function(t){return this.heapArray[t]},n.prototype.getChildrenOf=function(t){var e=this;return n.getChildrenIndexOf(t).map(function(a){return e.heapArray[a]}).filter(function(a){return a!==void 0})},n.prototype.getParentOf=function(t){var e=n.getParentIndexOf(t);return this.heapArray[e]},n.prototype[Symbol.iterator]=function(){return D(this,function(t){switch(t.label){case 0:return this.length?[4,this.pop()]:[3,2];case 1:return t.sent(),[3,0];case 2:return[2]}})},n.prototype.iterator=function(){return this},n.prototype._applyLimit=function(){if(this._limit&&this._limit<this.heapArray.length)for(var t=this.heapArray.length-this._limit;t;)this.heapArray.pop(),--t},n.prototype._bottomN_push=function(t){return v(this,void 0,void 0,function(){var e,a,i,s,o,r,o;return D(this,function(c){switch(c.label){case 0:return e=new n(this.compare),e.limit=t,e.heapArray=this.heapArray.slice(-t),[4,e.init()];case 1:for(c.sent(),a=this.heapArray.length-1-t,i=n.getParentIndexOf(a),s=[],o=a;o>i;--o)s.push(o);r=this.heapArray,c.label=2;case 2:return s.length?(o=s.shift(),[4,this.compare(r[o],e.peek())]):[3,6];case 3:return c.sent()>0?[4,e.replace(r[o])]:[3,5];case 4:c.sent(),o%2&&s.push(n.getParentIndexOf(o)),c.label=5;case 5:return[3,2];case 6:return[2,e.toArray()]}})})},n.prototype._moveNode=function(t,e){var a;a=x([this.heapArray[e],this.heapArray[t]],2),this.heapArray[t]=a[0],this.heapArray[e]=a[1]},n.prototype._sortNodeDown=function(t){return v(this,void 0,void 0,function(){var e,a,i,s,r,o;return D(this,function(c){switch(c.label){case 0:e=this.heapArray.length,c.label=1;case 1:return a=2*t+1,i=a+1,s=t,r=a<e,r?[4,this.compare(this.heapArray[a],this.heapArray[s])]:[3,3];case 2:r=c.sent()<0,c.label=3;case 3:return r&&(s=a),o=i<e,o?[4,this.compare(this.heapArray[i],this.heapArray[s])]:[3,5];case 4:o=c.sent()<0,c.label=5;case 5:if(o&&(s=i),s===t)return[3,7];this._moveNode(t,s),t=s,c.label=6;case 6:return[3,1];case 7:return[2]}})})},n.prototype._sortNodeUp=function(t){return v(this,void 0,void 0,function(){var e;return D(this,function(a){switch(a.label){case 0:return t>0?(e=n.getParentIndexOf(t),[4,this.compare(this.heapArray[t],this.heapArray[e])]):[3,2];case 1:if(a.sent()<0)this._moveNode(t,e),t=e;else return[3,2];return[3,0];case 2:return[2]}})})},n.prototype._topN_push=function(t){return v(this,void 0,void 0,function(){var e,a,i,s;return D(this,function(r){switch(r.label){case 0:e=new n(this._invertedCompare),e.limit=t,a=[0],i=this.heapArray,r.label=1;case 1:return a.length?(s=a.shift(),s<i.length?e.length<t?[4,e.push(i[s])]:[3,3]:[3,6]):[3,7];case 2:return r.sent(),a.push.apply(a,M([],x(n.getChildrenIndexOf(s)),!1)),[3,6];case 3:return[4,this.compare(i[s],e.peek())];case 4:return r.sent()<0?[4,e.replace(i[s])]:[3,6];case 5:r.sent(),a.push.apply(a,M([],x(n.getChildrenIndexOf(s)),!1)),r.label=6;case 6:return[3,1];case 7:return[2,e.toArray()]}})})},n.prototype._topN_fill=function(t){return v(this,void 0,void 0,function(){var e,a,i,s,r,r;return D(this,function(o){switch(o.label){case 0:return e=this.heapArray,a=new n(this._invertedCompare),a.limit=t,a.heapArray=e.slice(0,t),[4,a.init()];case 1:for(o.sent(),i=n.getParentIndexOf(t-1)+1,s=[],r=i;r<t;++r)s.push.apply(s,M([],x(n.getChildrenIndexOf(r).filter(function(c){return c<e.length})),!1));(t-1)%2&&s.push(t),o.label=2;case 2:return s.length?(r=s.shift(),r<e.length?[4,this.compare(e[r],a.peek())]:[3,5]):[3,6];case 3:return o.sent()<0?[4,a.replace(e[r])]:[3,5];case 4:o.sent(),s.push.apply(s,M([],x(n.getChildrenIndexOf(r)),!1)),o.label=5;case 5:return[3,2];case 6:return[2,a.toArray()]}})})},n.prototype._topN_heap=function(t){return v(this,void 0,void 0,function(){var e,a,i,s,r;return D(this,function(o){switch(o.label){case 0:e=this.clone(),a=[],i=0,o.label=1;case 1:return i<t?(r=(s=a).push,[4,e.pop()]):[3,4];case 2:r.apply(s,[o.sent()]),o.label=3;case 3:return++i,[3,1];case 4:return[2,a]}})})},n.prototype._topIdxOf=function(t){return v(this,void 0,void 0,function(){var e,a,i,s;return D(this,function(r){switch(r.label){case 0:if(!t.length)return[2,-1];e=0,a=t[e],i=1,r.label=1;case 1:return i<t.length?[4,this.compare(t[i],a)]:[3,4];case 2:s=r.sent(),s<0&&(e=i,a=t[i]),r.label=3;case 3:return++i,[3,1];case 4:return[2,e]}})})},n.prototype._topOf=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];return v(this,void 0,void 0,function(){var a;return D(this,function(i){switch(i.label){case 0:return a=new n(this.compare),[4,a.init(t)];case 1:return i.sent(),[2,a.peek()]}})})},n})(),fa=function(n,t){var e={label:0,sent:function(){if(s[0]&1)throw s[1];return s[1]},trys:[],ops:[]},a,i,s,r=Object.create((typeof Iterator=="function"?Iterator:Object).prototype);return r.next=o(0),r.throw=o(1),r.return=o(2),typeof Symbol=="function"&&(r[Symbol.iterator]=function(){return this}),r;function o(l){return function(h){return c([l,h])}}function c(l){if(a)throw new TypeError("Generator is already executing.");for(;r&&(r=0,l[0]&&(e=0)),e;)try{if(a=1,i&&(s=l[0]&2?i.return:l[0]?i.throw||((s=i.return)&&s.call(i),0):i.next)&&!(s=s.call(i,l[1])).done)return s;switch(i=0,s&&(l=[l[0]&2,s.value]),l[0]){case 0:case 1:s=l;break;case 4:return e.label++,{value:l[1],done:!1};case 5:e.label++,i=l[1],l=[0];continue;case 7:l=e.ops.pop(),e.trys.pop();continue;default:if(s=e.trys,!(s=s.length>0&&s[s.length-1])&&(l[0]===6||l[0]===2)){e=0;continue}if(l[0]===3&&(!s||l[1]>s[0]&&l[1]<s[3])){e.label=l[1];break}if(l[0]===6&&e.label<s[1]){e.label=s[1],s=l;break}if(s&&e.label<s[2]){e.label=s[2],e.ops.push(l);break}s[2]&&e.ops.pop(),e.trys.pop();continue}l=t.call(n,e)}catch(h){l=[6,h],i=0}finally{a=s=0}if(l[0]&5)throw l[1];return{value:l[0]?l[1]:void 0,done:!0}}},w=function(n,t){var e=typeof Symbol=="function"&&n[Symbol.iterator];if(!e)return n;var a=e.call(n),i,s=[],r;try{for(;(t===void 0||t-- >0)&&!(i=a.next()).done;)s.push(i.value)}catch(o){r={error:o}}finally{try{i&&!i.done&&(e=a.return)&&e.call(a)}finally{if(r)throw r.error}}return s},E=function(n,t,e){if(e||arguments.length===2)for(var a=0,i=t.length,s;a<i;a++)(s||!(a in t))&&(s||(s=Array.prototype.slice.call(t,0,a)),s[a]=t[a]);return n.concat(s||Array.prototype.slice.call(t))};var Xt=(function(){function n(t){t===void 0&&(t=n.minComparator);var e=this;this.compare=t,this.heapArray=[],this._limit=0,this.offer=this.add,this.element=this.peek,this.poll=this.pop,this.removeAll=this.clear,this._invertedCompare=function(a,i){return-1*e.compare(a,i)}}return n.getChildrenIndexOf=function(t){return[t*2+1,t*2+2]},n.getParentIndexOf=function(t){if(t<=0)return-1;var e=t%2?1:2;return Math.floor((t-e)/2)},n.getSiblingIndexOf=function(t){if(t<=0)return-1;var e=t%2?1:-1;return t+e},n.minComparator=function(t,e){return t>e?1:t<e?-1:0},n.maxComparator=function(t,e){return e>t?1:e<t?-1:0},n.minComparatorNumber=function(t,e){return t-e},n.maxComparatorNumber=function(t,e){return e-t},n.defaultIsEqual=function(t,e){return t===e},n.print=function(t){function e(h){var m=n.getParentIndexOf(h);return Math.floor(Math.log2(m+1))}function a(h,m){for(var f="";m>0;--m)f+=h;return f}for(var i=0,s=[],r=e(t.length-1)+2,o=0;i<t.length;){var c=e(i)+1;i===0&&(c=0);var l=String(t.get(i));l.length>o&&(o=l.length),s[c]=s[c]||[],s[c].push(l),i+=1}return s.map(function(h,m){var f=Math.pow(2,r-m)-1;return a(" ",Math.floor(f/2)*o)+h.map(function(u){var g=(o-u.length)/2;return a(" ",Math.ceil(g))+u+a(" ",Math.floor(g))}).join(a(" ",f*o))}).join(`\n`)},n.heapify=function(t,e){var a=new n(e);return a.heapArray=t,a.init(),a},n.heappop=function(t,e){var a=new n(e);return a.heapArray=t,a.pop()},n.heappush=function(t,e,a){var i=new n(a);i.heapArray=t,i.push(e)},n.heappushpop=function(t,e,a){var i=new n(a);return i.heapArray=t,i.pushpop(e)},n.heapreplace=function(t,e,a){var i=new n(a);return i.heapArray=t,i.replace(e)},n.heaptop=function(t,e,a){e===void 0&&(e=1);var i=new n(a);return i.heapArray=t,i.top(e)},n.heapbottom=function(t,e,a){e===void 0&&(e=1);var i=new n(a);return i.heapArray=t,i.bottom(e)},n.nlargest=function(t,e,a){var i=new n(a);return i.heapArray=E([],w(e),!1),i.init(),i.top(t)},n.nsmallest=function(t,e,a){var i=new n(a);return i.heapArray=E([],w(e),!1),i.init(),i.bottom(t)},n.prototype.add=function(t){return this._sortNodeUp(this.heapArray.push(t)-1),this._applyLimit(),!0},n.prototype.addAll=function(t){var e,a=this.length;(e=this.heapArray).push.apply(e,E([],w(t),!1));for(var i=this.length;a<i;++a)this._sortNodeUp(a);return this._applyLimit(),!0},n.prototype.bottom=function(t){return t===void 0&&(t=1),this.heapArray.length===0||t<=0?[]:this.heapArray.length===1?[this.heapArray[0]]:t>=this.heapArray.length?E([],w(this.heapArray),!1):this._bottomN_push(~~t)},n.prototype.check=function(){var t=this;return this.heapArray.find(function(e,a){return!!t.getChildrenOf(a).find(function(i){return t.compare(e,i)>0})})},n.prototype.clear=function(){this.heapArray=[]},n.prototype.clone=function(){var t=new n(this.comparator());return t.heapArray=this.toArray(),t._limit=this._limit,t},n.prototype.comparator=function(){return this.compare},n.prototype.contains=function(t,e){return e===void 0&&(e=n.defaultIsEqual),this.indexOf(t,e)!==-1},n.prototype.init=function(t){t&&(this.heapArray=E([],w(t),!1));for(var e=Math.floor(this.heapArray.length);e>=0;--e)this._sortNodeDown(e);this._applyLimit()},n.prototype.isEmpty=function(){return this.length===0},n.prototype.indexOf=function(t,e){if(e===void 0&&(e=n.defaultIsEqual),this.heapArray.length===0)return-1;for(var a=[],i=0;i<this.heapArray.length;){var s=this.heapArray[i];if(e(s,t))return i;this.compare(s,t)<=0&&a.push.apply(a,E([],w(n.getChildrenIndexOf(i)),!1)),i=a.shift()||this.heapArray.length}return-1},n.prototype.indexOfEvery=function(t,e){if(e===void 0&&(e=n.defaultIsEqual),this.heapArray.length===0)return[];for(var a=[],i=[],s=0;s<this.heapArray.length;){var r=this.heapArray[s];e(r,t)?(i.push(s),a.push.apply(a,E([],w(n.getChildrenIndexOf(s)),!1))):this.compare(r,t)<=0&&a.push.apply(a,E([],w(n.getChildrenIndexOf(s)),!1)),s=a.shift()||this.heapArray.length}return i},n.prototype.leafs=function(){if(this.heapArray.length===0)return[];var t=n.getParentIndexOf(this.heapArray.length-1);return this.heapArray.slice(t+1)},Object.defineProperty(n.prototype,"length",{get:function(){return this.heapArray.length},enumerable:!1,configurable:!0}),Object.defineProperty(n.prototype,"limit",{get:function(){return this._limit},set:function(t){t<0||isNaN(t)?this._limit=0:this._limit=~~t,this._applyLimit()},enumerable:!1,configurable:!0}),n.prototype.setLimit=function(t){return this.limit=t,t<0||isNaN(t)?NaN:this._limit},n.prototype.peek=function(){return this.heapArray[0]},n.prototype.pop=function(){var t=this.heapArray.pop();return this.length>0&&t!==void 0?this.replace(t):t},n.prototype.push=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];return t.length<1?!1:t.length===1?this.add(t[0]):this.addAll(t)},n.prototype.pushpop=function(t){var e;return this.compare(this.heapArray[0],t)<0&&(e=w([this.heapArray[0],t],2),t=e[0],this.heapArray[0]=e[1],this._sortNodeDown(0)),t},n.prototype.remove=function(t,e){var a=this;if(e===void 0&&(e=n.defaultIsEqual),!this.heapArray.length)return!1;if(t===void 0)return this.pop(),!0;for(var i=[0];i.length;){var s=i.shift();if(e(this.heapArray[s],t))return s===0?this.pop():s===this.heapArray.length-1?this.heapArray.pop():(this.heapArray.splice(s,1,this.heapArray.pop()),this._sortNodeUp(s),this._sortNodeDown(s)),!0;if(this.compare(this.heapArray[s],t)<=0){var r=n.getChildrenIndexOf(s).filter(function(o){return o<a.heapArray.length});i.push.apply(i,E([],w(r),!1))}}return!1},n.prototype.replace=function(t){var e=this.heapArray[0];return this.heapArray[0]=t,this._sortNodeDown(0),e},n.prototype.size=function(){return this.length},n.prototype.top=function(t){return t===void 0&&(t=1),this.heapArray.length===0||t<=0?[]:this.heapArray.length===1||t===1?[this.heapArray[0]]:t>=this.heapArray.length?E([],w(this.heapArray),!1):this._topN_push(~~t)},n.prototype.toArray=function(){return E([],w(this.heapArray),!1)},n.prototype.toString=function(){return this.heapArray.toString()},n.prototype.get=function(t){return this.heapArray[t]},n.prototype.getChildrenOf=function(t){var e=this;return n.getChildrenIndexOf(t).map(function(a){return e.heapArray[a]}).filter(function(a){return a!==void 0})},n.prototype.getParentOf=function(t){var e=n.getParentIndexOf(t);return this.heapArray[e]},n.prototype[Symbol.iterator]=function(){return fa(this,function(t){switch(t.label){case 0:return this.length?[4,this.pop()]:[3,2];case 1:return t.sent(),[3,0];case 2:return[2]}})},n.prototype.iterator=function(){return this.toArray()},n.prototype._applyLimit=function(){if(this._limit>0&&this._limit<this.heapArray.length)for(var t=this.heapArray.length-this._limit;t;)this.heapArray.pop(),--t},n.prototype._bottomN_push=function(t){var e=new n(this.compare);e.limit=t,e.heapArray=this.heapArray.slice(-t),e.init();for(var a=this.heapArray.length-1-t,i=n.getParentIndexOf(a),s=[],r=a;r>i;--r)s.push(r);for(var o=this.heapArray;s.length;){var r=s.shift();this.compare(o[r],e.peek())>0&&(e.replace(o[r]),r%2&&s.push(n.getParentIndexOf(r)))}return e.toArray()},n.prototype._moveNode=function(t,e){var a;a=w([this.heapArray[e],this.heapArray[t]],2),this.heapArray[t]=a[0],this.heapArray[e]=a[1]},n.prototype._sortNodeDown=function(t){for(var e=this.heapArray.length;;){var a=2*t+1,i=a+1,s=t;if(a<e&&this.compare(this.heapArray[a],this.heapArray[s])<0&&(s=a),i<e&&this.compare(this.heapArray[i],this.heapArray[s])<0&&(s=i),s===t)break;this._moveNode(t,s),t=s}},n.prototype._sortNodeUp=function(t){for(;t>0;){var e=n.getParentIndexOf(t);if(this.compare(this.heapArray[t],this.heapArray[e])<0)this._moveNode(t,e),t=e;else break}},n.prototype._topN_push=function(t){var e=new n(this._invertedCompare);e.limit=t;for(var a=[0],i=this.heapArray;a.length;){var s=a.shift();s<i.length&&(e.length<t?(e.push(i[s]),a.push.apply(a,E([],w(n.getChildrenIndexOf(s)),!1))):this.compare(i[s],e.peek())<0&&(e.replace(i[s]),a.push.apply(a,E([],w(n.getChildrenIndexOf(s)),!1))))}return e.toArray()},n.prototype._topN_fill=function(t){var e=this.heapArray,a=new n(this._invertedCompare);a.limit=t,a.heapArray=e.slice(0,t),a.init();for(var i=n.getParentIndexOf(t-1)+1,s=[],r=i;r<t;++r)s.push.apply(s,E([],w(n.getChildrenIndexOf(r).filter(function(o){return o<e.length})),!1));for((t-1)%2&&s.push(t);s.length;){var r=s.shift();r<e.length&&this.compare(e[r],a.peek())<0&&(a.replace(e[r]),s.push.apply(s,E([],w(n.getChildrenIndexOf(r)),!1)))}return a.toArray()},n.prototype._topN_heap=function(t){for(var e=this.clone(),a=[],i=0;i<t;++i)a.push(e.pop());return a},n.prototype._topIdxOf=function(t){if(!t.length)return-1;for(var e=0,a=t[e],i=1;i<t.length;++i){var s=this.compare(t[i],a);s<0&&(e=i,a=t[i])}return e},n.prototype._topOf=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];var a=new n(this.compare);return a.init(t),a.peek()},n})();var Jt=class{constructor(){this.minHeap=new Xt((t,e)=>t.time-e.time)}addEvent(t){this.minHeap.push(t)}getNextEvent(){return this.minHeap.pop()}containsEventOfType(t){return this.minHeap.toArray().some(a=>a.type==t)}containsEventOfTypeAndHrid(t,e){return this.minHeap.toArray().some(i=>i.type==t&&i.hrid==e)}clear(){this.minHeap=new Xt((t,e)=>t.time-e.time)}clearEventsForUnit(t){this.clearMatching(e=>e.source==t||e.target==t)}clearEventsOfType(t){this.clearMatching(e=>e.type==t)}clearMatching(t){let e=!1,a=this.minHeap.toArray();for(let i of a)t(i)&&(this.minHeap.remove(i),e=!0);return e}getMatching(t){let e=this.minHeap.toArray();for(let a of e)if(t(a))return a;return null}},Ne=Jt;var wt=class wt extends y{constructor(t,e){super(wt.type,t),this.hrid=e}};p(wt,"type","playerRespawn");var te=wt,ot=te;var Et=class Et extends y{constructor(t){super(Et.type,t)}};p(Et,"type","regenTick");var ee=Et,lt=ee;var xt=class xt extends y{constructor(t,e){super(xt.type,t),this.source=e}};p(xt,"type","stunExpiration");var ae=xt,ct=ae;var Rt=class Rt extends y{constructor(t,e){super(Rt.type,t),this.source=e}};p(Rt,"type","blindExpiration");var ie=Rt,ht=ie;var Ht=class Ht extends y{constructor(t,e){super(Ht.type,t),this.source=e}};p(Ht,"type","silenceExpiration");var se=Ht,mt=se;var Z=class Z extends y{constructor(t,e,a){super(Z.type,t),this.curseAmount=Math.min(e+1,Z.maxCurseStacks),this.source=a}};p(Z,"type","curseExpiration"),p(Z,"maxCurseStacks",5);var re=Z,q=re;var Y=class Y extends y{constructor(t,e,a){super(Y.type,t),this.weakenAmount=Math.min(e+1,Y.maxWeakenStacks),this.source=a}};p(Y,"type","weakenExpiration"),p(Y,"maxWeakenStacks",5);var ne=Y,F=ne;var Bt=class Bt extends y{constructor(t,e,a){super(Bt.type,t),this.furyAmount=e,this.source=a}};p(Bt,"type","furyExpiration");var oe=Bt,U=oe;var Mt=class Mt extends y{constructor(t,e){super(Mt.type,t),this.encounterTime=e}};p(Mt,"type","enrageTick");var le=Mt,$=le;var qe=S("combatStyleDetailMap");var ce=class{constructor(t,e,a){this.deaths={},this.experienceGained={},this.encounters=0,this.attacks={},this.consumablesUsed={},this.hitpointsGained={},this.manapointsGained={},this.debuffOnLevelGap={},this.dropRateMultiplier={},this.rareFindMultiplier={},this.combatDropQuantity={},this.playerRanOutOfMana={player1:!1,player2:!1,player3:!1,player4:!1,player5:!1},this.playerRanOutOfManaTime={},this.manaUsed={},this.timeSpentAlive=[],this.bossSpawns=[],this.hitpointsSpent={},this.zoneName=t?.hrid,this.difficultyTier=t?.difficultyTier,this.labyrinthName=e?.monsterHrid,this.roomLevel=e?.roomLevel,this.isDungeon=!1,this.isLabyrinth=!!e,this.dungeonsCompleted=0,this.dungeonsFailed=0,this.maxWaveReached=0,this.numberOfPlayers=a,this.maxEnrageStack=0,this.minDungenonTime=0,this.maxDungenonTime=0,this.lastDungeonFinishTime=0,this.lastEncounterFinishTime=0,this.labyAttemptCount=0,this.wipeEvents=[],this.timeSeriesData={timestamps:[],players:{}}}addWipeEvent(t,e,a){this.wipeEvents.push({simulationTime:e,logs:t,wave:a,timestamp:new Date().toISOString()})}addDeath(t){this.deaths[t.hrid]||(this.deaths[t.hrid]=0),this.deaths[t.hrid]+=1}updateTimeSpentAlive(t,e,a){let i=this.timeSpentAlive.findIndex(s=>s.name===t);if(e)i!==-1?(this.timeSpentAlive[i].alive=!0,this.timeSpentAlive[i].spawnedAt=a):this.timeSpentAlive.push({name:t,timeSpentAlive:0,spawnedAt:a,alive:!0,count:0});else{let s=a-this.timeSpentAlive[i].spawnedAt;this.timeSpentAlive[i].alive=!1,this.timeSpentAlive[i].timeSpentAlive+=s,this.timeSpentAlive[i].count+=1}}updateDungenonFinish(t,e){let a=this.timeSpentAlive.findIndex(s=>s.name===t);if(a==-1)return;let i=e-this.timeSpentAlive[a].spawnedAt;(this.minDungenonTime==0||this.minDungenonTime>i)&&(this.minDungenonTime=i),this.maxDungenonTime<i&&(this.maxDungenonTime=i)}addExperienceGain(t,e){if(!t.isPlayer)return;this.experienceGained[t.hrid]||(this.experienceGained[t.hrid]={stamina:0,intelligence:0,attack:0,melee:0,defense:0,ranged:0,magic:0});let a={stamina:0,intelligence:0,attack:0,melee:0,defense:0,ranged:0,magic:0},i=t.combatDetails.combatStats.primaryTraining;a[i.split("/")[2]]=.3;let s=qe[t.combatDetails.combatStats.combatStyleHrid].skillExpMap,r=Object.keys(s).length,o=t.combatDetails.combatStats.focusTraining;o&&s[o]?a[o.split("/")[2]]+=.7:Object.keys(s).forEach(c=>{a[c.split("/")[2]]+=.7/r});for(let[c,l]of Object.entries(a)){if(l<=0)continue;let h=l*(1+t.combatDetails.combatStats[c+"Experience"]);this.experienceGained[t.hrid][c]+=e*(1+t.combatDetails.combatStats.combatExperience)*h*(1+t.debuffOnLevelGap)}}addEncounterEnd(){this.encounters++}addAttack(t,e,a,i){this.attacks[t.hrid]||(this.attacks[t.hrid]={}),this.attacks[t.hrid][e.hrid]||(this.attacks[t.hrid][e.hrid]={}),this.attacks[t.hrid][e.hrid][a]||(this.attacks[t.hrid][e.hrid][a]={}),this.attacks[t.hrid][e.hrid][a][i]||(this.attacks[t.hrid][e.hrid][a][i]=0),this.attacks[t.hrid][e.hrid][a][i]+=1}addConsumableUse(t,e){this.consumablesUsed[t.hrid]||(this.consumablesUsed[t.hrid]={}),this.consumablesUsed[t.hrid][e.hrid]||(this.consumablesUsed[t.hrid][e.hrid]=0),this.consumablesUsed[t.hrid][e.hrid]+=1}addHitpointsGained(t,e,a){this.hitpointsGained[t.hrid]||(this.hitpointsGained[t.hrid]={}),this.hitpointsGained[t.hrid][e]||(this.hitpointsGained[t.hrid][e]=0),this.hitpointsGained[t.hrid][e]+=a}addManapointsGained(t,e,a){this.manapointsGained[t.hrid]||(this.manapointsGained[t.hrid]={}),this.manapointsGained[t.hrid][e]||(this.manapointsGained[t.hrid][e]=0),this.manapointsGained[t.hrid][e]+=a}setDropRateMultipliers(t){this.dropRateMultiplier[t.hrid]||(this.dropRateMultiplier[t.hrid]={}),this.dropRateMultiplier[t.hrid]=1+t.combatDetails.combatStats.combatDropRate,this.rareFindMultiplier[t.hrid]||(this.rareFindMultiplier[t.hrid]={}),this.rareFindMultiplier[t.hrid]=1+t.combatDetails.combatStats.combatRareFind,this.combatDropQuantity[t.hrid]||(this.combatDropQuantity[t.hrid]={}),this.combatDropQuantity[t.hrid]=t.combatDetails.combatStats.combatDropQuantity,this.debuffOnLevelGap[t.hrid]||(this.debuffOnLevelGap[t.hrid]={}),this.debuffOnLevelGap[t.hrid]=t.debuffOnLevelGap}setManaUsed(t){this.manaUsed[t.hrid]={};for(let[e,a]of t.abilityManaCosts.entries())this.manaUsed[t.hrid][e]=a}addHitpointsSpent(t,e,a){this.hitpointsSpent[t.hrid]||(this.hitpointsSpent[t.hrid]={}),this.hitpointsSpent[t.hrid][e]||(this.hitpointsSpent[t.hrid][e]=0),this.hitpointsSpent[t.hrid][e]+=a}addRanOutOfManaCount(t,e,a){e&&(this.playerRanOutOfMana[t.hrid]=!0),this.playerRanOutOfManaTime[t.hrid]||(this.playerRanOutOfManaTime[t.hrid]={isOutOfMana:!1,startTimeForOutOfMana:0,totalTimeForOutOfMana:0}),e?this.playerRanOutOfManaTime[t.hrid].isOutOfMana||(this.playerRanOutOfManaTime[t.hrid].isOutOfMana=!0,this.playerRanOutOfManaTime[t.hrid].startTimeForOutOfMana=a):this.playerRanOutOfManaTime[t.hrid].isOutOfMana&&(this.playerRanOutOfManaTime[t.hrid].isOutOfMana=!1,this.playerRanOutOfManaTime[t.hrid].totalTimeForOutOfMana+=a-this.playerRanOutOfManaTime[t.hrid].startTimeForOutOfMana)}addTimeSeriesSnapshot(t,e){this.timeSeriesData.timestamps.push(t),e.forEach(a=>{this.timeSeriesData.players[a.hrid]||(this.timeSeriesData.players[a.hrid]={hp:[],mp:[],maxHp:[],maxMp:[]});let i=this.timeSeriesData.players[a.hrid];i.hp.push(a.combatDetails.currentHitpoints),i.mp.push(a.combatDetails.currentManapoints),i.maxHp.push(a.combatDetails.maxHitpoints),i.maxMp.push(a.combatDetails.maxManapoints)})}},X=ce;var kt=class kt extends y{constructor(t,e,a){super(kt.type,t),this.source=e,this.ability=a}};p(kt,"type","abilityCastEndEvent");var he=kt,C=he;var Ct=class Ct extends y{constructor(t,e){super(Ct.type,t),this.source=e}};p(Ct,"type","awaitCooldownEvent");var me=Ct,J=me;var ue=class{constructor(t,e=1){p(this,"startTime");this.uniqueHrid=t.uniqueHrid,this.typeHrid=t.typeHrid,this.ratioBoost=t.ratioBoost+(e-1)*t.ratioBoostLevelBonus,this.flatBoost=t.flatBoost+(e-1)*t.flatBoostLevelBonus,this.duration=t.duration,this.multiplierForSkillHrid=t.multiplierForSkillHrid??"",this.multiplierPerSkillLevel=t.multiplierPerSkillLevel??0}},L=ue;var Fe=S("abilityDetailMap");var Ue=S("combatTriggerDependencyDetailMap");var pe=class n{constructor(t,e,a,i=0){this.dependencyHrid=t,this.conditionHrid=e,this.comparatorHrid=a,this.value=i}static createFromDTO(t){return new n(t.dependencyHrid,t.conditionHrid,t.comparatorHrid,t.value)}isActive(t,e,a,i,s){return Ue[this.dependencyHrid].isSingleTarget?this.isActiveSingleTarget(t,e,s):this.isActiveMultiTarget(a,i,s)}isActiveSingleTarget(t,e,a){let i;switch(this.dependencyHrid){case"/combat_trigger_dependencies/self":i=this.getDependencyValue(t,a);break;case"/combat_trigger_dependencies/targeted_enemy":if(!e)return!1;i=this.getDependencyValue(e,a);break;default:throw new Error("Unknown dependencyHrid in trigger: "+this.dependencyHrid)}return this.compareValue(i)}isActiveMultiTarget(t,e,a){let i;switch(this.dependencyHrid){case"/combat_trigger_dependencies/all_allies":i=t;break;case"/combat_trigger_dependencies/all_enemies":if(!e)return!1;i=e;break;default:throw new Error("Unknown dependencyHrid in trigger: "+this.dependencyHrid)}let s;switch(this.conditionHrid){case"/combat_trigger_conditions/number_of_active_units":s=i.filter(r=>r.combatDetails.currentHitpoints>0).length;break;case"/combat_trigger_conditions/number_of_dead_units":s=i.filter(r=>r.combatDetails.currentHitpoints<=0).length;break;case"/combat_trigger_conditions/lowest_hp_percentage":s=i.filter(r=>r.combatDetails.currentHitpoints>0).reduce((r,o)=>{let c=o.combatDetails.currentHitpoints/o.combatDetails.maxHitpoints;return c<r?c:r},2)*100;break;default:s=i.filter(r=>r.combatDetails.currentHitpoints>0).map(r=>this.getDependencyValue(r,a)).reduce((r,o)=>r+o,0);break}return this.compareValue(s)}getDependencyValue(t,e){switch(this.conditionHrid){case"/combat_trigger_conditions/berserk":case"/combat_trigger_conditions/frenzy":case"/combat_trigger_conditions/precision":case"/combat_trigger_conditions/vampirism":case"/combat_trigger_conditions/attack_coffee":case"/combat_trigger_conditions/defense_coffee":case"/combat_trigger_conditions/lucky_coffee":case"/combat_trigger_conditions/magic_coffee":case"/combat_trigger_conditions/melee_coffee":case"/combat_trigger_conditions/ranged_coffee":case"/combat_trigger_conditions/swiftness_coffee":case"/combat_trigger_conditions/wisdom_coffee":case"/combat_trigger_conditions/ice_spear":case"/combat_trigger_conditions/puncture":case"/combat_trigger_conditions/frost_surge":case"/combat_trigger_conditions/elusiveness":case"/combat_trigger_conditions/channeling_coffee":case"/combat_trigger_conditions/fierce_aura":case"/combat_trigger_conditions/invincible_armor":case"/combat_trigger_conditions/invincible_fire_resistance":case"/combat_trigger_conditions/invincible_nature_resistance":case"/combat_trigger_conditions/invincible_water_resistance":case"/combat_trigger_conditions/provoke":case"/combat_trigger_conditions/taunt":case"/combat_trigger_conditions/crippling_slash":case"/combat_trigger_conditions/mana_spring":case"/combat_trigger_conditions/retribution":case"/combat_trigger_conditions/fracturing_impact":case"/combat_trigger_conditions/maim":case"/combat_trigger_conditions/curse":case"/combat_trigger_conditions/weaken":let a="/buff_uniques";return a+=this.conditionHrid.slice(this.conditionHrid.lastIndexOf("/")),t.combatBuffs[a];case"/combat_trigger_conditions/critical_aura":case"/combat_trigger_conditions/critical_coffee":case"/combat_trigger_conditions/intelligence_coffee":case"/combat_trigger_conditions/stamina_coffee":case"/combat_trigger_conditions/elemental_affinity":case"/combat_trigger_conditions/fury":case"/combat_trigger_conditions/guardian_aura":case"/combat_trigger_conditions/insanity":case"/combat_trigger_conditions/spike_shell":case"/combat_trigger_conditions/toxic_pollen":case"/combat_trigger_conditions/invincible":case"/combat_trigger_conditions/mystic_aura":case"/combat_trigger_conditions/pestilent_shot":case"/combat_trigger_conditions/smoke_burst":case"/combat_trigger_conditions/speed_aura":case"/combat_trigger_conditions/toughness":case"/combat_trigger_conditions/enrage":let i="/buff_uniques";i+=this.conditionHrid.slice(this.conditionHrid.lastIndexOf("/"));let s=Object.keys(t.combatBuffs).filter(r=>r.startsWith(i));return t.combatBuffs[s?.[0]];case"/combat_trigger_conditions/current_hp":return t.combatDetails.currentHitpoints;case"/combat_trigger_conditions/current_mp":return t.combatDetails.currentManapoints;case"/combat_trigger_conditions/missing_hp":return t.combatDetails.maxHitpoints-t.combatDetails.currentHitpoints;case"/combat_trigger_conditions/missing_mp":return t.combatDetails.maxManapoints-t.combatDetails.currentManapoints;case"/combat_trigger_conditions/stun_status":return t.isStunned||t.stunExpireTime==e;case"/combat_trigger_conditions/blind_status":return t.isBlinded||t.blindExpireTime==e;case"/combat_trigger_conditions/silence_status":return t.isSilenced||t.silenceExpireTime==e;default:throw new Error("Unknown conditionHrid in trigger: "+this.conditionHrid)}}compareValue(t){switch(this.comparatorHrid){case"/combat_trigger_comparators/greater_than_equal":return t>=this.value;case"/combat_trigger_comparators/less_than_equal":return t<=this.value;case"/combat_trigger_comparators/is_active":return!!t;case"/combat_trigger_comparators/is_inactive":return!t;default:throw new Error("Unknown comparatorHrid in trigger: "+this.comparatorHrid)}}},tt=pe;var da={blaze:{hrid:"/abilities/blaze",name:"Blaze",description:"",isSpecialAbility:!1,manaCost:0,cooldownDuration:0,castDuration:0,abilityEffects:[{targetType:"allEnemies",effectType:"/ability_effect_types/damage",combatStyleHrid:"/combat_styles/magic",damageType:"/damage_types/fire",baseDamageFlat:0,baseDamageFlatLevelBonus:0,baseDamageRatio:.3,baseDamageRatioLevelBonus:0,bonusAccuracyRatio:0,bonusAccuracyRatioLevelBonus:0,damageOverTimeRatio:0,damageOverTimeDuration:0,armorDamageRatio:0,armorDamageRatioLevelBonus:0,hpDrainRatio:0,pierceChance:0,blindChance:0,blindDuration:0,silenceChance:0,silenceDuration:0,stunChance:0,stunDuration:0,spendHpRatio:0,buffs:null}],defaultCombatTriggers:[{dependencyHrid:"/combat_trigger_dependencies/all_enemies",conditionHrid:"/combat_trigger_conditions/number_of_active_units",comparatorHrid:"/combat_trigger_comparators/greater_than_equal",value:1},{dependencyHrid:"/combat_trigger_dependencies/all_enemies",conditionHrid:"/combat_trigger_conditions/current_hp",comparatorHrid:"/combat_trigger_comparators/greater_than_equal",value:1}]},bloom:{hrid:"/abilities/bloom",name:"Bloom",description:"",isSpecialAbility:!1,manaCost:0,cooldownDuration:0,castDuration:0,abilityEffects:[{targetType:"lowestHpAlly",effectType:"/ability_effect_types/heal",combatStyleHrid:"/combat_styles/magic",damageType:"",baseDamageFlat:10,baseDamageFlatLevelBonus:0,baseDamageRatio:.15,baseDamageRatioLevelBonus:0,bonusAccuracyRatio:0,bonusAccuracyRatioLevelBonus:0,damageOverTimeRatio:0,damageOverTimeDuration:0,armorDamageRatio:0,armorDamageRatioLevelBonus:0,hpDrainRatio:0,pierceChance:0,blindChance:0,blindDuration:0,silenceChance:0,silenceDuration:0,stunChance:0,stunDuration:0,spendHpRatio:0,buffs:null}],defaultCombatTriggers:[{dependencyHrid:"/combat_trigger_dependencies/all_allies",conditionHrid:"/combat_trigger_conditions/lowest_hp_percentage",comparatorHrid:"/combat_trigger_comparators/less_than_equal",value:100}]}},fe=class n{constructor(t,e=1,a=null){this.hrid=t,this.level=e;let i=Fe[t];if(i||(i=da[t]),!i)throw new Error("No ability found for hrid: "+this.hrid);this.manaCost=i.manaCost,this.cooldownDuration=i.cooldownDuration,this.castDuration=i.castDuration,this.isSpecialAbility=i.isSpecialAbility,this.abilityEffects=[];for(let s of i.abilityEffects){let r={targetType:s.targetType,effectType:s.effectType,combatStyleHrid:s.combatStyleHrid,damageType:s.damageType,damageFlat:s.baseDamageFlat+(this.level-1)*s.baseDamageFlatLevelBonus,damageRatio:s.baseDamageRatio+(this.level-1)*s.baseDamageRatioLevelBonus,bonusAccuracyRatio:s.bonusAccuracyRatio+(this.level-1)*s.bonusAccuracyRatioLevelBonus,damageOverTimeRatio:s.damageOverTimeRatio,damageOverTimeDuration:s.damageOverTimeDuration,armorDamageRatio:s.armorDamageRatio+(this.level-1)*s.armorDamageRatioLevelBonus,hpDrainRatio:s.hpDrainRatio,pierceChance:s.pierceChance,blindChance:s.blindChance,blindDuration:s.blindDuration,silenceChance:s.silenceChance,silenceDuration:s.silenceDuration,stunChance:s.stunChance,stunDuration:s.stunDuration,spendHpRatio:s.spendHpRatio,buffs:null};if(s.buffs){r.buffs=[];for(let o of s.buffs)r.buffs.push(new L(o,this.level))}this.abilityEffects.push(r)}if(a)this.triggers=a;else{this.triggers=[];for(let s of i.defaultCombatTriggers){let r=new tt(s.dependencyHrid,s.conditionHrid,s.comparatorHrid,s.value);this.triggers.push(r)}}this.lastUsed=Number.MIN_SAFE_INTEGER}static createFromDTO(t){let e=t.triggers.map(i=>tt.createFromDTO(i));return new n(t.hrid,t.level,e)}shouldTrigger(t,e,a,i,s){if(e.isStunned||e.isSilenced)return!1;let r=e.combatDetails.combatStats.abilityHaste,o=this.cooldownDuration;if(r>0&&(o=o*100/(100+r)),this.lastUsed+o>t)return!1;if(this.triggers.length==0)return!0;let c=!0;for(let l of this.triggers)l.isActive(e,a,i,s,t)||(c=!1);return c}},W=fe;var de=class{constructor(){p(this,"isPlayer");p(this,"isStunned",!1);p(this,"stunExpireTime",null);p(this,"isBlinded",!1);p(this,"blindExpireTime",null);p(this,"isSilenced",!1);p(this,"silenceExpireTime",null);p(this,"isOutOfMana",!1);p(this,"staminaLevel",1);p(this,"intelligenceLevel",1);p(this,"attackLevel",1);p(this,"meleeLevel",1);p(this,"defenseLevel",1);p(this,"rangedLevel",1);p(this,"magicLevel",1);p(this,"experience",0);p(this,"experienceRate",0);p(this,"enrageTime",0);p(this,"abilities",[null,null,null,null]);p(this,"food",[null,null,null]);p(this,"drinks",[null,null,null]);p(this,"houseRooms",[]);p(this,"achievements",null);p(this,"dropTable",[]);p(this,"rareDropTable",[]);p(this,"abilityManaCosts",new Map);p(this,"combatDetails",{staminaLevel:1,intelligenceLevel:1,attackLevel:1,meleeLevel:1,defenseLevel:1,rangedLevel:1,magicLevel:1,maxHitpoints:110,currentHitpoints:110,maxManapoints:110,currentManapoints:110,stabAccuracyRating:11,slashAccuracyRating:11,smashAccuracyRating:11,rangedAccuracyRating:11,magicAccuracyRating:11,stabMaxDamage:11,slashMaxDamage:11,smashMaxDamage:11,rangedMaxDamage:11,magicMaxDamage:11,stabEvasionRating:11,slashEvasionRating:11,smashEvasionRating:11,rangedEvasionRating:11,magicEvasionRating:11,defensiveMaxDamage:0,totalArmor:.2,totalWaterResistance:.4,totalNatureResistance:.4,totalFireResistance:.4,abilityHaste:0,tenacity:0,totalThreat:100,combatStats:{combatStyleHrid:"/combat_styles/smash",damageType:"/damage_types/physical",attackInterval:3e9,autoAttackDamage:0,abilityDamage:0,criticalRate:0,criticalDamage:0,stabAccuracy:0,slashAccuracy:0,smashAccuracy:0,rangedAccuracy:0,magicAccuracy:0,stabDamage:0,slashDamage:0,smashDamage:0,rangedDamage:0,magicDamage:0,defensiveDamage:0,taskDamage:0,physicalAmplify:0,waterAmplify:0,natureAmplify:0,fireAmplify:0,healingAmplify:0,physicalThorns:0,elementalThorns:0,maxHitpoints:0,maxManapoints:0,stabEvasion:0,slashEvasion:0,smashEvasion:0,rangedEvasion:0,magicEvasion:0,armor:0,waterResistance:0,natureResistance:0,fireResistance:0,lifeSteal:0,hpRegenPer10:.01,mpRegenPer10:.01,combatDropRate:0,combatDropQuantity:0,combatRareFind:0,combatExperience:0,foodSlots:1,drinkSlots:1,armorPenetration:0,waterPenetration:0,naturePenetration:0,firePenetration:0,manaLeech:0,castSpeed:0,threat:100,parry:0,mayhem:0,pierce:0,curse:0,ripple:0,bloom:0,blaze:0,weaken:0,fury:0,foodHaste:0,drinkConcentration:0,damageTaken:0,attackSpeed:0,armorDamageRatio:0,hpDrainRatio:0,primaryTraining:"",focusTraining:"",staminaExperience:0,intelligenceExperience:0,attackExperience:0,defenseExperience:0,meleeExperience:0,rangedExperience:0,magicExperience:0,retaliation:0,maxHitpointsRatio:0,maxManapointsRatio:0}});p(this,"combatBuffs",{});p(this,"permanentBuffs",{});p(this,"zoneBuffs",{});p(this,"extraBuffs",{})}updateCombatDetails(){this.isPlayer&&(this.combatDetails.combatStats.hpRegenPer10===0?this.combatDetails.combatStats.hpRegenPer10=.01:this.combatDetails.combatStats.hpRegenPer10=.01+this.combatDetails.combatStats.hpRegenPer10,this.combatDetails.combatStats.mpRegenPer10===0?this.combatDetails.combatStats.mpRegenPer10=.01:this.combatDetails.combatStats.mpRegenPer10=.01+this.combatDetails.combatStats.mpRegenPer10),["stamina","intelligence","attack","melee","defense","ranged","magic"].forEach(d=>{this.combatDetails[d+"Level"]=this[d+"Level"],this.getBuffBoosts("/buff_types/"+d+"_level").forEach(P=>{this.combatDetails[d+"Level"]+=this[d+"Level"]*P.ratioBoost,this.combatDetails[d+"Level"]+=P.flatBoost})}),this.combatDetails.maxHitpoints=Math.floor((10*(10+this.combatDetails.staminaLevel)+this.combatDetails.combatStats.maxHitpoints)*(1+this.combatDetails.combatStats.maxHitpointsRatio)),this.combatDetails.maxManapoints=Math.floor((10*(10+this.combatDetails.intelligenceLevel)+this.combatDetails.combatStats.maxManapoints)*(1+this.combatDetails.combatStats.maxManapointsRatio));let t=this.getBuffBoost("/buff_types/fury_accuracy").ratioBoost,e=this.getBuffBoost("/buff_types/fury_damage").ratioBoost,a=this.getBuffBoost("/buff_types/accuracy").ratioBoost,i=this.getBuffBoost("/buff_types/damage").ratioBoost;["stab","slash","smash"].forEach(d=>{this.combatDetails[d+"AccuracyRating"]=(10+this.combatDetails.attackLevel)*(1+this.combatDetails.combatStats[d+"Accuracy"])*(1+a)*(1+t),this.combatDetails[d+"MaxDamage"]=(10+this.combatDetails.meleeLevel)*(1+this.combatDetails.combatStats[d+"Damage"])*(1+i)*(1+e);let R=(10+this.combatDetails.defenseLevel)*(1+this.combatDetails.combatStats[d+"Evasion"]);this.combatDetails[d+"EvasionRating"]=R;let P=this.getBuffBoosts("/buff_types/evasion");for(let N of P)this.combatDetails[d+"EvasionRating"]+=N.flatBoost,this.combatDetails[d+"EvasionRating"]+=R*N.ratioBoost}),this.combatDetails.defensiveMaxDamage=(10+this.combatDetails.defenseLevel)*(1+this.combatDetails.combatStats.defensiveDamage)*(1+i)*(1+e),this.equipment?.["/equipment_types/two_hand"]?.hrid.includes("bulwark")&&(this.combatDetails.smashMaxDamage+=this.combatDetails.defensiveMaxDamage),this.combatDetails.rangedAccuracyRating=(10+this.combatDetails.attackLevel)*(1+this.combatDetails.combatStats.rangedAccuracy)*(1+a)*(1+t),this.combatDetails.rangedMaxDamage=(10+this.combatDetails.rangedLevel)*(1+this.combatDetails.combatStats.rangedDamage)*(1+i)*(1+e);let s=(10+this.combatDetails.defenseLevel)*(1+this.combatDetails.combatStats.rangedEvasion);this.combatDetails.rangedEvasionRating=s;let r=this.getBuffBoosts("/buff_types/evasion");for(let d of r)this.combatDetails.rangedEvasionRating+=d.flatBoost,this.combatDetails.rangedEvasionRating+=s*d.ratioBoost;this.combatDetails.combatStats.damageTaken=this.getBuffBoost("/buff_types/damage_taken").flatBoost,this.combatDetails.magicAccuracyRating=(10+this.combatDetails.attackLevel)*(1+this.combatDetails.combatStats.magicAccuracy)*(1+a)*(1+t),this.combatDetails.magicMaxDamage=(10+this.combatDetails.magicLevel)*(1+this.combatDetails.combatStats.magicDamage)*(1+i)*(1+e);let o=(10+this.combatDetails.defenseLevel)*(1+this.combatDetails.combatStats.magicEvasion);this.combatDetails.magicEvasionRating=o;for(let d of r)this.combatDetails.magicEvasionRating+=d.flatBoost,this.combatDetails.magicEvasionRating+=o*d.ratioBoost;this.combatDetails.combatStats.physicalAmplify+=this.getBuffBoost("/buff_types/physical_amplify").flatBoost,this.combatDetails.combatStats.waterAmplify+=this.getBuffBoost("/buff_types/water_amplify").flatBoost,this.combatDetails.combatStats.natureAmplify+=this.getBuffBoost("/buff_types/nature_amplify").flatBoost,this.combatDetails.combatStats.fireAmplify+=this.getBuffBoost("/buff_types/fire_amplify").flatBoost,this.combatDetails.combatStats.healingAmplify+=this.getBuffBoost("/buff_types/healing_amplify").flatBoost,this.combatDetails.combatStats.attackInterval/=1+this.combatDetails.attackLevel/2e3;let c=this.combatDetails.combatStats.attackSpeed;this.combatDetails.combatStats.attackInterval/=1+c;let h=this.getBuffBoosts("/buff_types/attack_speed").map(d=>d.ratioBoost).reduce((d,R)=>d+R,0);this.combatDetails.combatStats.attackInterval/=1+h;let m=.2*this.combatDetails.defenseLevel+this.combatDetails.combatStats.armor;this.combatDetails.totalArmor=m;let f=this.getBuffBoosts("/buff_types/armor");for(let d of f)this.combatDetails.totalArmor+=d.flatBoost,this.combatDetails.totalArmor+=m*d.ratioBoost;let u=.2*this.combatDetails.defenseLevel+this.combatDetails.combatStats.waterResistance;this.combatDetails.totalWaterResistance=u;let g=this.getBuffBoosts("/buff_types/water_resistance");for(let d of g)this.combatDetails.totalWaterResistance+=d.flatBoost,this.combatDetails.totalWaterResistance+=u*d.ratioBoost;let b=.2*this.combatDetails.defenseLevel+this.combatDetails.combatStats.natureResistance;this.combatDetails.totalNatureResistance=b;let T=this.getBuffBoosts("/buff_types/nature_resistance");for(let d of T)this.combatDetails.totalNatureResistance+=d.flatBoost,this.combatDetails.totalNatureResistance+=b*d.ratioBoost;let z=.2*this.combatDetails.defenseLevel+this.combatDetails.combatStats.fireResistance;this.combatDetails.totalFireResistance=z;let pt=this.getBuffBoosts("/buff_types/fire_resistance");for(let d of pt)this.combatDetails.totalFireResistance+=d.flatBoost,this.combatDetails.totalFireResistance+=z*d.ratioBoost;let ft=this.getBuffBoost("/buff_types/hp_regen");this.combatDetails.combatStats.hpRegenPer10+=this.combatDetails.combatStats.hpRegenPer10*ft.ratioBoost,this.combatDetails.combatStats.hpRegenPer10+=ft.flatBoost;let dt=this.getBuffBoost("/buff_types/mp_regen");this.combatDetails.combatStats.mpRegenPer10+=this.combatDetails.combatStats.mpRegenPer10*dt.ratioBoost,this.combatDetails.combatStats.mpRegenPer10+=dt.flatBoost,this.combatDetails.combatStats.lifeSteal+=this.getBuffBoost("/buff_types/life_steal").flatBoost,this.combatDetails.combatStats.physicalThorns+=this.getBuffBoost("/buff_types/physical_thorns").flatBoost,this.combatDetails.combatStats.elementalThorns+=this.getBuffBoost("/buff_types/elemental_thorns").flatBoost,this.combatDetails.combatStats.combatExperience+=this.getBuffBoost("/buff_types/wisdom").flatBoost,this.combatDetails.combatStats.criticalRate+=this.getBuffBoost("/buff_types/critical_rate").flatBoost,this.combatDetails.combatStats.criticalDamage+=this.getBuffBoost("/buff_types/critical_damage").flatBoost,this.combatDetails.combatStats.castSpeed+=this.getBuffBoost("/buff_types/cast_speed").flatBoost,this.combatDetails.combatStats.castSpeed+=this.combatDetails.attackLevel/2e3;let at=this.getBuffBoost("/buff_types/combat_drop_rate");this.combatDetails.combatStats.combatDropRate+=(1+this.combatDetails.combatStats.combatDropRate)*at.ratioBoost,this.combatDetails.combatStats.combatDropRate+=at.flatBoost;let bt=this.getBuffBoost("/buff_types/rare_find");this.combatDetails.combatStats.combatRareFind+=(1+this.combatDetails.combatStats.combatRareFind)*bt.ratioBoost,this.combatDetails.combatStats.combatRareFind+=bt.flatBoost;let it=this.getBuffBoost("/buff_types/combat_drop_quantity");this.combatDetails.combatStats.combatDropQuantity+=(1+this.combatDetails.combatStats.combatDropQuantity)*it.ratioBoost,this.combatDetails.combatStats.combatDropQuantity+=it.flatBoost;let G=100+this.combatDetails.combatStats.threat;this.combatDetails.totalThreat=G;let I=this.getBuffBoost("/buff_types/threat");I.ratioBoost!==0?this.combatDetails.combatStats.threat+=G*I.ratioBoost:this.combatDetails.combatStats.threat=G,this.combatDetails.combatStats.threat+=I.flatBoost,this.combatDetails.combatStats.retaliation+=this.getBuffBoost("/buff_types/retaliation").flatBoost,this.combatDetails.combatStats.tenacity+=this.getBuffBoost("/buff_types/tenacity").flatBoost}addBuffs(t,e){t.forEach(i=>i.startTime=e);let a=!1;for(let i of t)(!this.combatBuffs[i.uniqueHrid]||this.combatBuffs[i.uniqueHrid].ratioBoost!=i.ratioBoost||this.combatBuffs[i.uniqueHrid].flatBoost!=i.flatBoost)&&(a=!0),this.combatBuffs[i.uniqueHrid]=i;a&&this.updateCombatDetails()}addBuff(t,e){t.startTime=e;let a=!0;this.combatBuffs[t.uniqueHrid]&&this.combatBuffs[t.uniqueHrid].ratioBoost===t.ratioBoost&&this.combatBuffs[t.uniqueHrid].flatBoost===t.flatBoost&&(a=!1),this.combatBuffs[t.uniqueHrid]=t,a&&this.updateCombatDetails()}removeBuffs(t){let e=!1;t.forEach(a=>{this.combatBuffs[a.uniqueHrid]&&(delete this.combatBuffs[a.uniqueHrid],e=!0)}),e&&this.updateCombatDetails()}removeBuff(t){this.combatBuffs[t.uniqueHrid]&&(delete this.combatBuffs[t.uniqueHrid],this.updateCombatDetails())}addPermanentBuff(t){this.permanentBuffs[t.typeHrid]?(this.permanentBuffs[t.typeHrid].flatBoost+=t.flatBoost,this.permanentBuffs[t.typeHrid].ratioBoost+=t.ratioBoost):this.permanentBuffs[t.typeHrid]={uniqueHrid:t.uniqueHrid,typeHrid:t.typeHrid,flatBoost:t.flatBoost,ratioBoost:t.ratioBoost,duration:t.duration}}generatePermanentBuffs(){for(let t=0;t<this.houseRooms.length;t++)this.houseRooms[t].buffs.forEach(a=>{this.addPermanentBuff(a)});this.achievements&&this.achievements.buffs.forEach(t=>{this.addPermanentBuff(t)}),this.zoneBuffs&&this.zoneBuffs.forEach(t=>{this.addPermanentBuff(t)}),this.extraBuffs&&this.extraBuffs.forEach(t=>{this.addPermanentBuff(t)})}removeExpiredBuffs(t){Object.values(this.combatBuffs).filter(a=>a.startTime+a.duration<=t).forEach(a=>{delete this.combatBuffs[a.uniqueHrid]}),this.updateCombatDetails()}clearBuffs(){this.combatBuffs=structuredClone(this.permanentBuffs),this.updateCombatDetails()}clearCCs(){this.isStunned=!1,this.stunExpireTime=null,this.isSilenced=!1,this.silenceExpireTime=null,this.isBlinded=!1,this.blindExpireTime=null,this.combatDetails.combatStats.damageTaken=0}getBuffBoosts(t){let e=[];return Object.values(this.combatBuffs).filter(a=>a.typeHrid==t).forEach(a=>{e.push({ratioBoost:a.ratioBoost,flatBoost:a.flatBoost})}),e}getBuffBoost(t){let e=this.getBuffBoosts(t),a={ratioBoost:0,flatBoost:0};for(let i=0;i<e.length;i++)a.ratioBoost+=e[i]?.ratioBoost??0,a.flatBoost+=e[i]?.flatBoost??0;return a}reset(t=0){this.clearCCs(),t==0||!this.isPlayer?(this.clearBuffs(),this.resetCooldowns(t)):this.removeExpiredBuffs(t),this.combatDetails.currentHitpoints=this.combatDetails.maxHitpoints,this.combatDetails.currentManapoints=this.combatDetails.maxManapoints}resetCooldowns(t=0){this.food.filter(a=>a!=null).forEach(a=>a.lastUsed=Number.MIN_SAFE_INTEGER),this.drinks.filter(a=>a!=null).forEach(a=>a.lastUsed=Number.MIN_SAFE_INTEGER);let e=this.combatDetails.combatStats.abilityHaste;this.abilities.filter(a=>a!=null).forEach(a=>{if(this.isPlayer)a.lastUsed=Number.MIN_SAFE_INTEGER;else{let i=a.cooldownDuration;e>0&&(i=i*100/(100+e)),a.lastUsed=t-Math.floor(i*.5)+Math.floor(Math.random()*i*.5)}})}addHitpoints(t){let e=0;if(this.combatDetails.currentHitpoints>=this.combatDetails.maxHitpoints)return e;let a=Math.min(this.combatDetails.currentHitpoints+t,this.combatDetails.maxHitpoints);return e=a-this.combatDetails.currentHitpoints,this.combatDetails.currentHitpoints=a,e}addManapoints(t){let e=0;if(this.combatDetails.currentManapoints>=this.combatDetails.maxManapoints)return e;let a=Math.min(this.combatDetails.currentManapoints+t,this.combatDetails.maxManapoints);return e=a-this.combatDetails.currentManapoints,this.combatDetails.currentManapoints=a,e}},Lt=de;var be=S("combatMonsterDetailMap");var ge=class{constructor(t,e,a,i,s){this.itemHrid=t,this.dropRate=e,this.minCount=a,this.maxCount=i,this.difficultyTier=s}},ye=ge;var De=class extends Lt{constructor(e,a=0,i=0){super();p(this,"difficultyTier",0);p(this,"LabyrinthMonsterBaseRoomLevel",100);p(this,"roomLevel",0);this.isPlayer=!1,this.hrid=e,this.difficultyTier=a,this.roomLevel=i,this.roomLevel<=0&&(this.roomLevel=this.LabyrinthMonsterBaseRoomLevel);let s=be[this.hrid];if(!s)throw new Error("No monster found for hrid: "+this.hrid);this.enrageTime=s.enrageTime;let r=this.roomLevel/this.LabyrinthMonsterBaseRoomLevel;for(let o=0;o<s.abilities.length;o++)s.abilities[o].minDifficultyTier>this.difficultyTier||(this.abilities[o]=new W(s.abilities[o].abilityHrid,Math.floor(s.abilities[o].level*r)));if(s.dropTable)for(let o=0;o<s.dropTable.length;o++)this.dropTable[o]=new ye(s.dropTable[o].itemHrid,s.dropTable[o].dropRate,s.dropTable[o].minCount,s.dropTable[o].maxCount,s.dropTable[o].difficultyTier);for(let o=0;o<s.rareDropTable.length;o++){let l=(s.dropTable&&o<s.dropTable.length?s.dropTable[o]:null)?.difficultyTier??s.rareDropTable[o].minDifficultyTier;this.rareDropTable[o]=new ye(s.rareDropTable[o].itemHrid,s.rareDropTable[o].dropRate,s.rareDropTable[o].minCount,l)}}updateCombatDetails(){let e=be[this.hrid],a=1+.25*this.difficultyTier,i=1+.15*this.difficultyTier,s=20*this.difficultyTier,r=this.roomLevel/this.LabyrinthMonsterBaseRoomLevel;this.staminaLevel=a*(e.combatDetails.staminaLevel+s)*r,this.intelligenceLevel=a*(e.combatDetails.intelligenceLevel+s)*r,this.attackLevel=a*(e.combatDetails.attackLevel+s)*r,this.meleeLevel=a*(e.combatDetails.meleeLevel+s)*r,this.defenseLevel=i*(e.combatDetails.defenseLevel+s)*r,this.rangedLevel=a*(e.combatDetails.rangedLevel+s)*r,this.magicLevel=a*(e.combatDetails.magicLevel+s)*r;let o=1+.5*this.difficultyTier,c=5*this.difficultyTier;this.experience=o*(e.experience+c),this.combatDetails.combatStats.combatStyleHrid=e.combatDetails.combatStats.combatStyleHrids[0];for(let[l,h]of Object.entries(e.combatDetails.combatStats))this.combatDetails.combatStats[l]=h;this.combatDetails.combatStats.armor*=r,this.combatDetails.combatStats.waterResistance*=r,this.combatDetails.combatStats.natureResistance*=r,this.combatDetails.combatStats.fireResistance*=r,["stabAccuracy","slashAccuracy","smashAccuracy","rangedAccuracy","magicAccuracy","stabDamage","slashDamage","smashDamage","rangedDamage","magicDamage","defensiveDamage","taskDamage","physicalAmplify","waterAmplify","natureAmplify","fireAmplify","healingAmplify","stabEvasion","slashEvasion","smashEvasion","rangedEvasion","magicEvasion","armor","waterResistance","natureResistance","fireResistance","maxHitpoints","maxManapoints","lifeSteal","hpRegenPer10","mpRegenPer10","physicalThorns","elementalThorns","combatDropRate","combatRareFind","combatDropQuantity","combatExperience","criticalRate","criticalDamage","armorPenetration","waterPenetration","naturePenetration","firePenetration","abilityHaste","tenacity","manaLeech","castSpeed","threat","parry","mayhem","pierce","curse","fury","weaken","ripple","bloom","blaze","attackSpeed","foodHaste","drinkConcentration","autoAttackDamage","abilityDamage","retaliation"].forEach(l=>{e.combatDetails.combatStats[l]==null&&(this.combatDetails.combatStats[l]=0)}),this.combatDetails.combatStats.attackInterval==0&&(this.combatDetails.combatStats.attackInterval=e.combatDetails.attackInterval),super.updateCombatDetails()}},O=De;var Q=1e9,ve=5*Q,Te=3*Q,Qe=10*Q,ba=3*Q,ga=150*Q,ya=3*Q,et=60*Q,Se=class extends EventTarget{constructor(t,e,a,i={}){super(),this.players=t,this.zone=e,this.labyrinth=a,this.eventQueue=new Ne,this.simResult=new X(e,a,t.length),this.allPlayersDead=!1,this.enableHpMpVisualization=i.enableHpMpVisualization||!1,this.wipeLogs={buffer:new Array(200),index:0,count:0,maxSize:200}}addToWipeLogs(t){let{buffer:e,maxSize:a}=this.wipeLogs;e[this.wipeLogs.index]=t,this.wipeLogs.index=(this.wipeLogs.index+1)%a,this.wipeLogs.count=Math.min(this.wipeLogs.count+1,a)}logAndResetWipeLogs(){this.getOrderedWipeLogs().forEach(e=>{if(e.error)return;let a=(e.time/1e9).toFixed(2)}),this.wipeLogs.index=0,this.wipeLogs.count=0}buildCombatLog(t,e,a,i){try{let s=t?.hrid||"UNKNOWN_SOURCE",r=a?.hrid||"UNKNOWN_TARGET",o=a?.combatDetails?.currentHitpoints||0,c=Math.max(0,o+i),l=this.players.map(h=>({hrid:h.hrid||"UNKNOWN_PLAYER",current:h.combatDetails?.currentHitpoints??0,max:h.combatDetails?.maxHitpoints??0}));return{time:this.simulationTime,wave:this.zone.encountersKilled-1,source:s,ability:e,target:r,damage:i,beforeHp:c,afterHp:o,playersHp:l,isCrit:!1}}catch(s){return{error:`[\\u65E5\\u5FD7\\u751F\\u6210\\u9519\\u8BEF] ${s.message}`}}}generateCombatLog(t,e,a,i){try{let s=t?.hrid||"UNKNOWN_SOURCE",r=a?.hrid||"UNKNOWN_TARGET",o=i?.damageDone||0,c=a?.combatDetails?.currentHitpoints||0,l=Math.max(0,c+o),h=this.players.map(m=>({hrid:m.hrid||"UNKNOWN_PLAYER",current:m.combatDetails?.currentHitpoints??0,max:m.combatDetails?.maxHitpoints??0}));return{time:this.simulationTime,wave:this.zone.encountersKilled-1,source:s,ability:e,target:r,damage:o,beforeHp:l,afterHp:c,playersHp:h,isCrit:i?.isCrit||!1}}catch(s){return{error:`[\\u65E5\\u5FD7\\u751F\\u6210\\u9519\\u8BEF] ${s.message}`}}}getOrderedWipeLogs(){let{buffer:t,maxSize:e,count:a}=this.wipeLogs,i=[];for(let s=0;s<a;s++){let r=(this.wipeLogs.index-a+e+s)%e;i.push(t[r])}return i}saveWipeLogsToSimResult(t){let e=this.getOrderedWipeLogs();this.simResult.addWipeEvent(e,this.simulationTime,t)}async simulate(t){this.reset();let e=0,a=new rt(0);for(this.eventQueue.addEvent(a);this.simulationTime<t;){let i=this.eventQueue.getNextEvent();if(await this.processEvent(i),e++,e==1e3){e=0,this.enableHpMpVisualization&&this.simResult.addTimeSeriesSnapshot(this.simulationTime,this.players);let s=new CustomEvent("progress",{detail:{zone:this.zone?.hrid,difficultyTier:this.zone?.difficultyTier,labyrinth:this.labyrinth?.hrid,roomLevel:this.labyrinth?.roomLevel,progress:Math.min(this.simulationTime/t,1),timeSeriesData:this.enableHpMpVisualization?this.simResult.timeSeriesData:null}});this.dispatchEvent(s)}}if(this.simResult.isDungeon=this.zone?.isDungeon??!1,this.zone&&this.simResult.isDungeon)if(this.simResult.dungeonsCompleted=this.zone.dungeonsCompleted,this.simResult.dungeonsFailed=this.zone.dungeonsFailed,this.simResult.dungeonsCompleted<1){this.simResult.maxWaveReached=0;for(let i=1;i<=this.zone.dungeonSpawnInfo.maxWaves;i++){let s="#"+i.toString(),r=this.simResult.timeSpentAlive.findIndex(o=>o.name===s);if(r==-1||this.simResult.timeSpentAlive[r].count==0)break;this.simResult.maxWaveReached=i}}else this.simResult.maxWaveReached=this.zone.dungeonSpawnInfo.maxWaves;this.simResult.simulatedTime=this.simulationTime;for(let i=0;i<this.players.length;i++)this.simResult.setDropRateMultipliers(this.players[i]),this.simResult.setManaUsed(this.players[i]);if(this.zone?.isDungeon&&Object.entries(this.zone.dungeonSpawnInfo.fixedSpawnsMap).forEach(([i,s])=>{let r="#"+i.toString();s.forEach(o=>{r+=","+o.combatMonsterHrid}),this.simResult.bossSpawns.push(r)}),this.zone?.isDungeon&&this.zone.monsterSpawnInfo.bossSpawns)for(let i of this.zone.monsterSpawnInfo.bossSpawns)this.simResult.bossSpawns.push(i.combatMonsterHrid);return this.labyrinth&&(this.simResult.labyAttemptCount=this.labyrinth.attemptCount),this.simResult}reset(){this.tempDungeonCount=0,this.simulationTime=0,this.eventQueue.clear(),this.simResult=new X(this.zone,this.labyrinth,this.players.length)}async processEvent(t){switch(this.simulationTime=t.time,t.type){case rt.type:this.processCombatStartEvent(t);break;case ot.type:this.processPlayerRespawnEvent(t);break;case $t.type:this.processEnemyRespawnEvent(t);break;case k.type:this.processAutoAttackEvent(t);break;case nt.type:this.processConsumableTickEvent(t);break;case st.type:this.processDamageOverTimeTickEvent(t);break;case j.type:this.processCheckBuffExpirationEvent(t);break;case lt.type:this.processRegenTickEvent(t);break;case ct.type:this.processStunExpirationEvent(t);break;case ht.type:this.processBlindExpirationEvent(t);break;case mt.type:this.processSilenceExpirationEvent(t);break;case q.type:this.processCurseExpirationEvent(t);break;case F.type:this.processWeakenExpirationEvent(t);break;case U.type:this.processFuryExpirationEvent(t);break;case $.type:this.processEnrageTickEvent(t);break;case C.type:this.tryUseAbility(t.source,t.ability);break;case J.type:this.addNextAttackEvent(t.source);break;case Zt.type:break}this.checkTriggers()}processCombatStartEvent(t){for(let a=0;a<this.players.length;a++)t.time==0&&this.players[a].generatePermanentBuffs(),this.labyrinth?this.players[a].reset():this.players[a].reset(this.simulationTime);let e=new lt(this.simulationTime+Qe);this.eventQueue.addEvent(e),this.startNewEncounter()}processPlayerRespawnEvent(t){let e=this.players.find(a=>a.hrid===t.hrid);e.combatDetails.currentHitpoints=e.combatDetails.maxHitpoints,e.combatDetails.currentManapoints=e.combatDetails.maxManapoints,e.clearBuffs(),e.clearCCs(),this.allPlayersDead?(this.allPlayersDead=!1,this.startAttacks()):this.addNextAttackEvent(e)}processEnemyRespawnEvent(t){this.startNewEncounter()}startNewEncounter(){if(this.allPlayersDead&&(this.allPlayersDead=!1,this.zone&&this.zone.failWave()),this.zone)if(!this.zone.isDungeon)this.enemies=this.zone.getRandomEncounter();else{this.enemies=this.zone.getNextWave(),this.simResult.updateTimeSpentAlive("#"+(this.zone.encountersKilled-1).toString(),!0,this.simulationTime);let e=this.zone.dungeonsCompleted;if(e>this.tempDungeonCount){this.tempDungeonCount=e;for(let a=0;a<this.players.length;a++)this.players[a].combatDetails.currentHitpoints=this.players[a].combatDetails.maxHitpoints,this.players[a].combatDetails.currentManapoints=this.players[a].combatDetails.maxManapoints}}this.labyrinth&&(this.enemies=this.labyrinth.getMonster(),this.labyrinth.updateEnconterStartTime(this.simulationTime)),this.enemies.forEach(e=>{e.reset(this.simulationTime),this.simResult.updateTimeSpentAlive(e.hrid,!0,this.simulationTime)}),this.eventQueue.clearEventsOfType($.type);let t=new $(this.simulationTime+et,et);this.eventQueue.addEvent(t),this.enrageBeginTime=this.simulationTime,this.eventQueue.clearEventsOfType(C.type),this.checkTriggers(),this.startAttacks()}startAttacks(){let t=[...this.players];this.enemies&&t.push(...this.enemies);for(let e of t)e.combatDetails.currentHitpoints<=0||this.addNextAttackEvent(e)}checkParry(t){let e=t.filter(i=>i&&i.combatDetails.currentHitpoints>0&&i.combatDetails.combatStats.parry>0);if(e.length<=0)return;let a=Math.floor(Math.random()*e.length);if(e[a].combatDetails.combatStats.parry>Math.random())return e[a]}processAutoAttackEvent(t){let e=t.source.isPlayer?this.enemies:this.players;if(!e)return;let a=e.filter(i=>i&&i.combatDetails.currentHitpoints>0);for(let i=0;i<a.length;i++){let s=a[i];if(!t.source.isPlayer&&a.length>1){let h=0,m=[];a.forEach(u=>{let g=u.combatDetails.combatStats.threat;h+=g,m.push({player:u,rangeStart:h-g,rangeEnd:h})});let f=Math.random()*h;s=m.find(u=>f>=u.rangeStart&&f<u.rangeEnd).player}let r=t.source,o=this.checkParry(e);o&&(s=r,r=o);let c=_.processAttack(r,s);if(this.zone?.isDungeon&&s.isPlayer&&c.didHit&&c.damageDone>0){let h=this.generateCombatLog(r,"autoAttack",s,c);this.addToWipeLogs(h)}let l=r.combatDetails.combatStats.mayhem>Math.random();if(c.didHit&&r.combatDetails.combatStats.curse>0){let m=this.eventQueue.getMatching(b=>b.type==q.type&&b.source==s),f=0;m&&(f=m.curseAmount),this.eventQueue.clearMatching(b=>b.type==q.type&&b.source==s);let u=new q(this.simulationTime+15e9,f,s),g={uniqueHrid:"/buff_uniques/curse",typeHrid:"/buff_types/damage_taken",ratioBoost:0,ratioBoostLevelBonus:0,flatBoost:r.combatDetails.combatStats.curse*u.curseAmount,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:15e9};s.addBuff(g,this.simulationTime),this.eventQueue.addEvent(u)}if(r.combatDetails.combatStats.fury>0){let h=this.eventQueue.getMatching(T=>T.type==U.type&&T.source==r);this.eventQueue.clearMatching(T=>T.type==U.type&&T.source==r);let m=15e9,f=5,u=0;h&&(u=h.furyAmount),c.didHit?u=Math.min(u+1,f):u=u/2;let g={uniqueHrid:"/buff_uniques/fury_accuracy",typeHrid:"/buff_types/fury_accuracy",ratioBoost:u*r.combatDetails.combatStats.fury,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:m},b={uniqueHrid:"/buff_uniques/fury_damage",typeHrid:"/buff_types/fury_damage",ratioBoost:u*r.combatDetails.combatStats.fury,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:m};if(u>0){let T=new U(this.simulationTime+m,u,r);this.eventQueue.addEvent(T),r.addBuffs([g,b],this.simulationTime)}else r.removeBuffs([g,b])}if(s.combatDetails.combatStats.weaken>0){let m=this.eventQueue.getMatching(b=>b.type==F.type&&b.source==r),f=0;m&&(f=m.weakenAmount),this.eventQueue.clearMatching(b=>b.type==F.type&&b.source==r);let u=new F(this.simulationTime+15e9,f,r),g={uniqueHrid:"/buff_uniques/weaken",typeHrid:"/buff_types/damage",ratioBoost:-1*s.combatDetails.combatStats.weaken*u.weakenAmount,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:15e9};r.addBuff(g,this.simulationTime),this.eventQueue.addEvent(u)}if(!l||l&&c.didHit||l&&i==a.length-1){let h="autoAttack";o&&(h="parry"),this.simResult.addAttack(r,s,h,c.didHit?c.damageDone:"miss")}if(c.lifeStealHeal>0&&this.simResult.addHitpointsGained(r,"lifesteal",c.lifeStealHeal),c.manaLeechMana>0&&this.simResult.addManapointsGained(r,"manaLeech",c.manaLeechMana),c.thornDamageDone>0&&this.simResult.addAttack(s,r,c.thornType,c.thornDamageDone),this.zone?.isDungeon&&c.thornDamageDone>0&&r.isPlayer){let h=this.buildCombatLog(s,c.thornType,r,c.thornDamageDone);this.addToWipeLogs(h)}if(s.combatDetails.combatStats.retaliation>0&&this.simResult.addAttack(s,r,"retaliation",c.retaliationDamageDone>0?c.retaliationDamageDone:"miss"),this.zone?.isDungeon&&c.retaliationDamageDone>0&&r.isPlayer){let h=this.buildCombatLog(s,"retaliation",r,c.retaliationDamageDone);this.addToWipeLogs(h)}if(s.combatDetails.currentHitpoints==0&&(this.eventQueue.clearEventsForUnit(s),this.simResult.addDeath(s),s.isPlayer||this.simResult.updateTimeSpentAlive(s.hrid,!1,this.simulationTime)),r.combatDetails.currentHitpoints==0&&(c.thornDamageDone!=0||c.retaliationDamageDone!=0)){this.eventQueue.clearEventsForUnit(r),this.simResult.addDeath(r),r.isPlayer||this.simResult.updateTimeSpentAlive(r.hrid,!1,this.simulationTime);break}if(!(l&&!c.didHit)&&(!c.didHit||o||r.combatDetails.combatStats.pierce<=Math.random()))break}this.checkEncounterEnd()||this.addNextAttackEvent(t.source)}checkEncounterEnd(){if(this.enemies){let e=this.enemies.filter(a=>a.combatDetails.currentHitpoints<=0&&a.experienceRate==0);e.length>0&&e.forEach(a=>{let i=this.simulationTime-this.enrageBeginTime;i>a.enrageTime&&(i=a.enrageTime),a.experienceRate=1+i/a.enrageTime})}let t=!1;if(this.enemies&&!this.enemies.some(e=>e.combatDetails.currentHitpoints>0)){this.eventQueue.clearEventsOfType(k.type);let e=new $t(this.simulationTime+ba);this.eventQueue.addEvent(e),this.enemies.some(i=>i.experienceRate<=0);let a=this.enemies.map(i=>i.experience*i.experienceRate).reduce((i,s)=>i+s,0);this.players.forEach(i=>{this.simResult.addExperienceGain(i,a/this.players.length)}),this.enemies=null,this.zone?.isDungeon&&(this.simResult.updateTimeSpentAlive("#"+(this.zone.encountersKilled-1).toString(),!1,this.simulationTime),this.zone.encountersKilled>this.zone.dungeonSpawnInfo.maxWaves&&(this.simResult.updateDungenonFinish("#1",this.simulationTime),this.simResult.lastDungeonFinishTime=this.simulationTime)),this.simResult.addEncounterEnd(),this.simResult.lastEncounterFinishTime=this.simulationTime,t=!0}if(this.players.forEach(e=>{if(e.combatDetails.currentHitpoints<=0&&!this.eventQueue.containsEventOfTypeAndHrid(ot.type,e.hrid)){if(this.zone&&!this.zone.isDungeon){let a=new ot(this.simulationTime+ga,e.hrid);this.eventQueue.addEvent(a)}this.simResult.addRanOutOfManaCount(e,!1,this.simulationTime)}}),!this.players.some(e=>e.combatDetails.currentHitpoints>0)){if(this.zone)if(this.zone.isDungeon){this.saveWipeLogsToSimResult(this.zone.encountersKilled-1),this.wipeLogs.index=0,this.wipeLogs.count=0,this.eventQueue.clearEventsOfType(k.type),this.eventQueue.clearEventsOfType(C.type),this.eventQueue.clearEventsOfType(st.type),this.eventQueue.clearEventsOfType(nt.type),this.eventQueue.clearEventsOfType(lt.type),this.eventQueue.clearEventsOfType($.type),this.eventQueue.clearEventsOfType(ct.type),this.eventQueue.clearEventsOfType(ht.type),this.eventQueue.clearEventsOfType(mt.type),this.eventQueue.clearEventsOfType(J.type),this.enemies=null;let e=new rt(this.simulationTime+ya);this.eventQueue.addEvent(e)}else this.eventQueue.clearEventsOfType(k.type),this.eventQueue.clearEventsOfType(C.type);t=!0,this.allPlayersDead=!0}if(this.labyrinth&&(this.labyrinth.checkTimeout(this.simulationTime)||t)){this.enemies=null,t=!0,this.eventQueue.clear();let e=new rt(this.simulationTime);this.eventQueue.addEvent(e)}return t}addNextAttackEvent(t){if(this.eventQueue.getMatching(o=>(o.type==C.type||o.type==k.type)&&o.source==t))return;let e,a,i;t.isPlayer?(e=_.getTarget(this.enemies),a=this.players,i=this.enemies):(e=_.getTarget(this.players),a=this.enemies,i=this.players);let s=!1,r=!1;if(t.abilities.filter(o=>o!=null).forEach(o=>{if(!s&&!r&&o.shouldTrigger(this.simulationTime,t,e,a,i)&&(this.canUseAbility(t,o,!0)||(r=!0),!r)){let c=o.castDuration;c/=1+t.combatDetails.combatStats.castSpeed;let l=new C(this.simulationTime+c,t,o);this.eventQueue.addEvent(l),s=!0}}),s){t.isOutOfMana=!1;return}if(i)if(t.isBlinded)t.isOutOfMana=!0;else{let o=new k(this.simulationTime+t.combatDetails.combatStats.attackInterval,t);this.eventQueue.addEvent(o)}}processConsumableTickEvent(t){if(t.consumable.hitpointRestore>0){let e=_.calculateTickValue(t.consumable.hitpointRestore,t.totalTicks,t.currentTick),a=t.source.addHitpoints(e);this.simResult.addHitpointsGained(t.source,t.consumable.hrid,a)}if(t.consumable.manapointRestore>0){let e=_.calculateTickValue(t.consumable.manapointRestore,t.totalTicks,t.currentTick),a=t.source.addManapoints(e);if(this.simResult.addManapointsGained(t.source,t.consumable.hrid,a),t.source.isOutOfMana){let i=new J(this.simulationTime,t.source);this.eventQueue.addEvent(i)}}if(t.currentTick<t.totalTicks){let e=new nt(this.simulationTime+ve,t.source,t.consumable,t.totalTicks,t.currentTick+1);this.eventQueue.addEvent(e)}}processDamageOverTimeTickEvent(t){let e=_.calculateTickValue(t.damage,t.totalTicks,t.currentTick),a=Math.min(e,t.target.combatDetails.currentHitpoints);if(t.target.combatDetails.currentHitpoints-=a,this.simResult.addAttack(t.sourceRef,t.target,"damageOverTime",a),this.zone?.isDungeon&&t.target.isPlayer){let i=this.buildCombatLog("","damageOverTime",t.target,a);this.addToWipeLogs(i)}if(t.currentTick<t.totalTicks){let i=new st(this.simulationTime+Te,t.sourceRef,t.target,t.damage,t.totalTicks,t.currentTick+1,t.combatStyleHrid);this.eventQueue.addEvent(i)}t.target.combatDetails.currentHitpoints==0&&(this.eventQueue.clearEventsForUnit(t.target),this.simResult.addDeath(t.target),t.target.isPlayer||this.simResult.updateTimeSpentAlive(t.target.hrid,!1,this.simulationTime)),this.checkEncounterEnd()}processRegenTickEvent(t){let e=[...this.players];for(let i of e){if(i.combatDetails.currentHitpoints<=0)continue;let s=Math.floor(i.combatDetails.maxHitpoints*i.combatDetails.combatStats.hpRegenPer10),r=i.addHitpoints(s);this.simResult.addHitpointsGained(i,"regen",r);let o=Math.floor(i.combatDetails.maxManapoints*i.combatDetails.combatStats.mpRegenPer10),c=i.addManapoints(o);if(this.simResult.addManapointsGained(i,"regen",c),i.isOutOfMana){let l=new J(this.simulationTime,i);this.eventQueue.addEvent(l)}}let a=new lt(this.simulationTime+Qe);this.eventQueue.addEvent(a)}processCheckBuffExpirationEvent(t){t.source.removeExpiredBuffs(this.simulationTime)}processStunExpirationEvent(t){t.source.isStunned=!1,this.addNextAttackEvent(t.source)}processBlindExpirationEvent(t){t.source.isBlinded=!1,this.addNextAttackEvent(t.source)}processSilenceExpirationEvent(t){t.source.isSilenced=!1}processCurseExpirationEvent(t){t.source.removeExpiredBuffs(this.simulationTime)}processWeakenExpirationEvent(t){t.source.removeExpiredBuffs(this.simulationTime)}processFuryExpirationEvent(t){t.source.removeExpiredBuffs(this.simulationTime)}processEnrageTickEvent(t){if(!this.enemies)return;let e=10;this.enemies.filter(i=>i.combatDetails.currentHitpoints>0).forEach(i=>{let s=Math.min(e,Math.floor(t.encounterTime/i.enrageTime));if(s<=0)return;let r={uniqueHrid:"/buff_uniques/enrage_damage",typeHrid:"/buff_types/damage",ratioBoost:s*.1,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:et},o={uniqueHrid:"/buff_uniques/enrage_accuracy",typeHrid:"/buff_types/accuracy",ratioBoost:s*.1,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:et};i.addBuffs([r,o]),this.simResult.maxEnrageStack=Math.max(this.simResult.maxEnrageStack,s)});let a=new $(this.simulationTime+et,t.encounterTime+et);this.eventQueue.addEvent(a)}checkTriggers(){let t;do t=!1,this.players.filter(e=>e.combatDetails.currentHitpoints>0).forEach(e=>{this.checkTriggersForUnit(e,this.players,this.enemies)&&(t=!0)}),this.enemies&&this.enemies.filter(e=>e.combatDetails.currentHitpoints>0).forEach(e=>{this.checkTriggersForUnit(e,this.enemies,this.players)&&(t=!0)});while(t)}checkTriggersForUnit(t,e,a){if(t.combatDetails.currentHitpoints<=0)throw new Error("Checking triggers for a dead unit");let i=!1,s=_.getTarget(a);for(let r of t.food)r&&r.shouldTrigger(this.simulationTime,t,s,e,a)&&this.tryUseConsumable(t,r)&&(i=!0);for(let r of t.drinks)r&&r.shouldTrigger(this.simulationTime,t,s,e,a)&&this.tryUseConsumable(t,r)&&(i=!0);return i}tryUseConsumable(t,e){if(t.combatDetails.currentHitpoints<=0)return!1;e.lastUsed=this.simulationTime;let a=e.cooldownDuration;t.combatDetails.combatStats.drinkConcentration>0&&e.catagoryHrid.includes("drink")?a=a/(1+t.combatDetails.combatStats.drinkConcentration):t.combatDetails.combatStats.foodHaste>0&&e.catagoryHrid.includes("food")&&(a=a/(1+t.combatDetails.combatStats.foodHaste));let i=new Zt(this.simulationTime+a);if(this.eventQueue.addEvent(i),this.simResult.addConsumableUse(t,e),e.recoveryDuration==0){if(e.hitpointRestore>0){let s=t.addHitpoints(e.hitpointRestore);this.simResult.addHitpointsGained(t,e.hrid,s)}if(e.manapointRestore>0){let s=t.addManapoints(e.manapointRestore);if(this.simResult.addManapointsGained(t,e.hrid,s),t.isOutOfMana){let r=new J(this.simulationTime,t);this.eventQueue.addEvent(r)}}}else{let s=new nt(this.simulationTime+ve,t,e,e.recoveryDuration/ve,1);this.eventQueue.addEvent(s)}for(let s of e.buffs){let r=structuredClone(s);t.combatDetails.combatStats.drinkConcentration>0&&e.catagoryHrid.includes("drink")&&(r.ratioBoost*=1+t.combatDetails.combatStats.drinkConcentration,r.flatBoost*=1+t.combatDetails.combatStats.drinkConcentration,r.duration=r.duration/(1+t.combatDetails.combatStats.drinkConcentration)),t.addBuff(r,this.simulationTime);let o=new j(this.simulationTime+r.duration,t);this.eventQueue.addEvent(o)}return!0}canUseAbility(t,e,a){return t.combatDetails.currentHitpoints<=0?!1:t.combatDetails.currentManapoints<e.manaCost?(t.isPlayer&&a&&this.simResult.addRanOutOfManaCount(t,!0,this.simulationTime),!1):(t.isPlayer&&a&&this.simResult.addRanOutOfManaCount(t,!1,this.simulationTime),!0)}tryUseAbility(t,e){if(!this.canUseAbility(t,e,!0))return!1;t.isPlayer&&(t.abilityManaCosts.has(e.hrid)?t.abilityManaCosts.set(e.hrid,t.abilityManaCosts.get(e.hrid)+e.manaCost):t.abilityManaCosts.set(e.hrid,e.manaCost)),t.combatDetails.currentManapoints-=e.manaCost,e.lastUsed=this.simulationTime;let a=t.combatDetails.combatStats.abilityHaste,i=e.cooldownDuration;a>0&&(i=i*100/(100+a));let s=[e];t.combatDetails.combatStats.blaze>0&&Math.random()<t.combatDetails.combatStats.blaze&&s.push(new W("blaze")),t.combatDetails.combatStats.bloom>0&&Math.random()<t.combatDetails.combatStats.bloom&&s.push(new W("bloom"));for(let r of s)for(let o of r.abilityEffects)switch(o.effectType){case"/ability_effect_types/buff":this.processAbilityBuffEffect(t,r,o);break;case"/ability_effect_types/damage":this.processAbilityDamageEffect(t,r,o);break;case"/ability_effect_types/heal":this.processAbilityHealEffect(t,r,o);break;case"/ability_effect_types/spend_hp":this.processAbilitySpendHpEffect(t,r,o);break;case"/ability_effect_types/revive":this.processAbilityReviveEffect(t,r,o);break;case"/ability_effect_types/promote":this.eventQueue.clearEventsForUnit(t),t=this.processAbilityPromoteEffect(t,r,o),this.addNextAttackEvent(t);break;default:throw new Error("Unsupported effect type for ability: "+r.hrid+" effectType: "+o.effectType)}if(t.combatDetails.combatStats.ripple>0&&Math.random()<t.combatDetails.combatStats.ripple){let r=t.addManapoints(10);this.simResult.addManapointsGained(t,"ripple",r);for(let o of t.abilities)o&&o.lastUsed&&o.lastUsed+o.cooldownDuration-this.simulationTime>0&&(o.lastUsed=Math.max(o.lastUsed-Q*2,this.simulationTime-o.cooldownDuration))}return this.addNextAttackEvent(t),t.combatDetails.currentHitpoints==0&&(this.eventQueue.clearEventsForUnit(t),this.simResult.addDeath(t),t.isPlayer||this.simResult.updateTimeSpentAlive(t.hrid,!1,this.simulationTime)),this.checkEncounterEnd(),!0}processAbilityBuffEffect(t,e,a){if(a.targetType=="allAllies"){let i=t.isPlayer?this.players:this.enemies;for(let s of i.filter(r=>r&&r.combatDetails.currentHitpoints>0))for(let r of a.buffs){if(e.isSpecialAbility&&r.multiplierForSkillHrid&&r.multiplierPerSkillLevel>0){let c=1+t.combatDetails[r.multiplierForSkillHrid.split("/")[2]+"Level"]*r.multiplierPerSkillLevel,l=structuredClone(r);l.flatBoost*=c,l.ratioBoost*=c,s.addBuff(l,this.simulationTime)}else s.addBuff(r,this.simulationTime);let o=new j(this.simulationTime+r.duration,s);this.eventQueue.addEvent(o)}return}if(a.targetType!="self")throw new Error("Unsupported target type for buff ability effect: "+e.hrid);for(let i of a.buffs){t.addBuff(i,this.simulationTime);let s=new j(this.simulationTime+i.duration,t);this.eventQueue.addEvent(s)}}processAbilityDamageEffect(t,e,a){let i;switch(a.targetType){case"enemy":case"allEnemies":i=t.isPlayer?this.enemies:this.players;break;default:throw new Error("Unsupported target type for damage ability effect: "+e.hrid)}if(!i)return;let s=[],r=!1;for(let o of i.filter(c=>c&&c.combatDetails.currentHitpoints>0)){let c;if(r||(c=this.checkParry(i),r=!0),c){let l=t,h=c,m=_.processAttack(h,l);this.simResult.addAttack(h,l,"parry",m.didHit?m.damageDone:"miss"),m.lifeStealHeal>0&&this.simResult.addHitpointsGained(h,"lifesteal",m.lifeStealHeal),m.manaLeechMana>0&&this.simResult.addManapointsGained(h,"manaLeech",m.manaLeechMana),m.thornDamageDone>0&&this.simResult.addAttack(l,h,m.thornType,m.thornDamageDone),l.combatDetails.combatStats.retaliation>0&&this.simResult.addAttack(l,h,"retaliation",m.retaliationDamageDone>0?m.retaliationDamageDone:"miss"),l.combatDetails.currentHitpoints==0&&(this.eventQueue.clearEventsForUnit(l),this.simResult.addDeath(l),l.isPlayer||this.simResult.updateTimeSpentAlive(l.hrid,!1,this.simulationTime)),h.combatDetails.currentHitpoints==0&&(m.thornDamageDone!=0||m.retaliationDamageDone!=0)&&(this.eventQueue.clearEventsForUnit(h),this.simResult.addDeath(h),h.isPlayer||this.simResult.updateTimeSpentAlive(h.hrid,!1,this.simulationTime))}else{if(i=i.filter(h=>h&&!s.includes(h.hrid)&&h.combatDetails.currentHitpoints>0),!t.isPlayer&&i.length>0&&a.targetType=="enemy"){let h=0,m=[];i.forEach(u=>{let g=u.combatDetails.combatStats.threat;h+=g,m.push({player:u,rangeStart:h-g,rangeEnd:h})});let f=Math.random()*h;o=m.find(u=>f>=u.rangeStart&&f<u.rangeEnd).player,s.push(o.hrid)}if(i.length<=0)break;let l=_.processAttack(t,o,a);if(this.zone?.isDungeon&&o.isPlayer&&l.didHit&&l.damageDone>0){let h=this.generateCombatLog(t,e.hrid,o,l);this.addToWipeLogs(h)}if(l.hpDrain>0&&this.simResult.addHitpointsGained(t,e.hrid,l.hpDrain),l.didHit&&a.buffs)for(let h of a.buffs){o.addBuff(h,this.simulationTime);let m=new j(this.simulationTime+h.duration,o);this.eventQueue.addEvent(m)}if(a.damageOverTimeRatio>0&&l.damageDone>0){let h=new st(this.simulationTime+Te,t,o,l.damageDone*a.damageOverTimeRatio,a.damageOverTimeDuration/Te,1,a.combatStyleHrid);this.eventQueue.addEvent(h)}if(l.didHit&&a.stunChance>0&&Math.random()<a.stunChance*100/(100+o.combatDetails.combatStats.tenacity)){o.isStunned=!0,o.stunExpireTime=this.simulationTime+a.stunDuration,this.eventQueue.clearMatching(m=>(m.type==k.type||m.type==C.type||m.type==ct.type)&&m.source==o);let h=new ct(o.stunExpireTime,o);this.eventQueue.addEvent(h)}if(l.didHit&&a.blindChance>0&&Math.random()<a.blindChance*100/(100+o.combatDetails.combatStats.tenacity)){o.isBlinded=!0,o.blindExpireTime=this.simulationTime+a.blindDuration,this.eventQueue.clearMatching(m=>m.type==ht.type&&m.source==o),this.eventQueue.clearMatching(m=>m.type==k.type&&m.source==o)&&this.addNextAttackEvent(o);let h=new ht(o.blindExpireTime,o);this.eventQueue.addEvent(h)}if(l.didHit&&a.silenceChance>0&&Math.random()<a.silenceChance*100/(100+o.combatDetails.combatStats.tenacity)){o.isSilenced=!0,o.silenceExpireTime=this.simulationTime+a.silenceDuration,this.eventQueue.clearMatching(m=>m.type==mt.type&&m.source==o),this.eventQueue.clearMatching(m=>m.type==C.type&&m.source==o)&&this.addNextAttackEvent(o);let h=new mt(o.silenceExpireTime,o);this.eventQueue.addEvent(h)}if(l.didHit&&t.combatDetails.combatStats.curse>0){let m=this.eventQueue.getMatching(b=>b.type==q.type&&b.source==o),f=0;m&&(f=m.curseAmount),this.eventQueue.clearMatching(b=>b.type==q.type&&b.source==o);let u=new q(this.simulationTime+15e9,f,o),g={uniqueHrid:"/buff_uniques/curse",typeHrid:"/buff_types/damage_taken",ratioBoost:0,ratioBoostLevelBonus:0,flatBoost:t.combatDetails.combatStats.curse*u.curseAmount,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:15e9};o.addBuff(g,this.simulationTime),this.eventQueue.addEvent(u)}if(t.combatDetails.combatStats.fury>0){let h=this.eventQueue.getMatching(T=>T.type==U.type&&T.source==t);this.eventQueue.clearMatching(T=>T.type==U.type&&T.source==t);let m=15e9,f=5,u=0;h&&(u=h.furyAmount),l.didHit?u=Math.min(u+1,f):u=u/2;let g={uniqueHrid:"/buff_uniques/fury_accuracy",typeHrid:"/buff_types/fury_accuracy",ratioBoost:u*t.combatDetails.combatStats.fury,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:m},b={uniqueHrid:"/buff_uniques/fury_damage",typeHrid:"/buff_types/fury_damage",ratioBoost:u*t.combatDetails.combatStats.fury,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:m};if(u>0){let T=new U(this.simulationTime+m,u,t);this.eventQueue.addEvent(T),t.addBuffs([g,b],this.simulationTime)}else t.removeBuffs([g,b])}if(o.combatDetails.combatStats.weaken>0){t.weakenExpireTime=this.simulationTime+15e9;let m=this.eventQueue.getMatching(b=>b.type==F.type&&b.source==t),f=0;m&&(f=m.weakenAmount),this.eventQueue.clearMatching(b=>b.type==F.type&&b.source==t);let u=new F(this.simulationTime+15e9,f,t),g={uniqueHrid:"/buff_uniques/weaken",typeHrid:"/buff_types/damage",ratioBoost:-1*o.combatDetails.combatStats.weaken*u.weakenAmount,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:15e9};t.addBuff(g,this.simulationTime),this.eventQueue.addEvent(u)}if(this.simResult.addAttack(t,o,e.hrid,l.didHit?l.damageDone:"miss"),l.thornDamageDone>0&&this.simResult.addAttack(o,t,l.thornType,l.thornDamageDone),this.zone?.isDungeon&&l.thornDamageDone>0&&t.isPlayer){let h=this.buildCombatLog(o,l.thornType,t,l.thornDamageDone);this.addToWipeLogs(h)}if(o.combatDetails.combatStats.retaliation>0&&this.simResult.addAttack(o,t,"retaliation",l.retaliationDamageDone>0?l.retaliationDamageDone:"miss"),this.zone?.isDungeon&&l.retaliationDamageDone>0&&t.isPlayer){let h=this.buildCombatLog(o,"retaliation",t,l.retaliationDamageDone);this.addToWipeLogs(h)}if(o.combatDetails.currentHitpoints==0&&(this.eventQueue.clearEventsForUnit(o),this.simResult.addDeath(o),o.isPlayer||this.simResult.updateTimeSpentAlive(o.hrid,!1,this.simulationTime)),l.didHit&&a.pierceChance>Math.random())continue}if(c||a.targetType=="enemy")break}}processAbilityHealEffect(t,e,a){if(a.targetType=="allAllies"){let s=t.isPlayer?this.players:this.enemies;for(let r of s.filter(o=>o&&o.combatDetails.currentHitpoints>0)){let o=_.processHeal(t,a,r);this.simResult.addHitpointsGained(r,e.hrid,o)}return}if(a.targetType=="lowestHpAlly"){let s=t.isPlayer?this.players:this.enemies,r;for(let o of s.filter(c=>c&&c.combatDetails.currentHitpoints>0)){if(!r){r=o;continue}let c=o.combatDetails.currentHitpoints/o.combatDetails.maxHitpoints,l=r.combatDetails.currentHitpoints/r.combatDetails.maxHitpoints;c<l&&(r=o)}if(r){let o=_.processHeal(t,a,r);this.simResult.addHitpointsGained(r,e.hrid,o)}return}if(a.targetType!="self")throw new Error("Unsupported target type for heal ability effect: "+e.hrid);let i=_.processHeal(t,a,t);this.simResult.addHitpointsGained(t,e.hrid,i)}processAbilityReviveEffect(t,e,a){if(a.targetType!="deadAlly")throw new Error("Unsupported target type for revive ability effect: "+e.hrid);let s=(t.isPlayer?this.players:this.enemies).find(r=>r&&r.combatDetails.currentHitpoints<=0);if(s){this.eventQueue.clearMatching(o=>o.type==ot.type&&o.hrid==s.hrid),s.removeExpiredBuffs(this.simulationTime);let r=_.processRevive(t,a,s);this.simResult.addHitpointsGained(s,e.hrid,r),this.addNextAttackEvent(s),t.isPlayer||this.simResult.updateTimeSpentAlive(s.hrid,!0,this.simulationTime)}}processAbilityPromoteEffect(t,e,a){let i=["/monsters/enchanted_rook","/monsters/enchanted_knight","/monsters/enchanted_bishop"],s=Math.floor(Math.random()*i.length);return new O(i[s],t.difficultyTier)}processAbilitySpendHpEffect(t,e,a){if(a.targetType!="self")throw new Error("Unsupported target type for spend hp ability effect: "+e.hrid);let i=_.processSpendHp(t,a);this.simResult.addHitpointsSpent(t,e.hrid,i)}},ut=Se;var Ot=S("itemDetailMap");var Ae=class n{constructor(t,e=null){this.hrid=t;let a=Ot[this.hrid];if(!a)throw new Error("No consumable found for hrid: "+this.hrid);if(this.cooldownDuration=a.consumableDetail.cooldownDuration,this.hitpointRestore=a.consumableDetail.hitpointRestore,this.manapointRestore=a.consumableDetail.manapointRestore,this.recoveryDuration=a.consumableDetail.recoveryDuration,this.catagoryHrid=a.categoryHrid,this.buffs=[],a.consumableDetail.buffs)for(let i of a.consumableDetail.buffs){let s=new L(i);this.buffs.push(s)}if(e)this.triggers=e;else{this.triggers=[];for(let i of a.consumableDetail.defaultCombatTriggers){let s=new tt(i.dependencyHrid,i.conditionHrid,i.comparatorHrid,i.value);this.triggers.push(s)}}this.lastUsed=Number.MIN_SAFE_INTEGER}static createFromDTO(t){let e=t.triggers.map(i=>tt.createFromDTO(i));return new n(t.hrid,e)}shouldTrigger(t,e,a,i,s){if(e.isStunned)return!1;let r;this.catagoryHrid.includes("food")?r=e.combatDetails.combatStats.foodHaste:r=e.combatDetails.combatStats.drinkConcentration;let o=this.cooldownDuration;if(r>0&&(o=o/(1+r)),this.lastUsed+o>t)return!1;if(this.triggers.length==0)return!0;let c=!0;for(let l of this.triggers)l.isActive(e,a,i,s,t)||(c=!1);return c}},_e=Ae;var ze=S("enhancementLevelTotalBonusMultiplierTable");var we=class n{constructor(t,e){this.hrid=t;let a=Ot[this.hrid];if(!a)throw new Error("No equipment found for hrid: "+this.hrid);this.gameItem=a,this.enhancementLevel=e}static createFromDTO(t){return new n(t.hrid,t.enhancementLevel)}getCombatStat(t){let e=ze[this.enhancementLevel];if(this.gameItem.equipmentDetail.combatStats[t]){let a=this.gameItem.equipmentDetail.combatEnhancementBonuses[t]||0;return this.gameItem.equipmentDetail.combatStats[t]+e*a}return 0}getCombatStyle(){return this.gameItem.equipmentDetail.combatStats.combatStyleHrids[0]}getDamageType(){return this.gameItem.equipmentDetail.combatStats.damageType}getPrimaryTraining(){return this.gameItem.equipmentDetail.combatStats.primaryTraining}getFocusTraining(){return this.gameItem.equipmentDetail.combatStats.focusTraining}},We=we;var Ge=S("houseRoomDetailMap");var Ee=class{constructor(t,e){this.hrid=t,this.level=e;let a=Ge[this.hrid];if(!a)throw new Error("No house room found for hrid: "+this.hrid);if(this.buffs=[],a.actionBuffs)for(let i of a.actionBuffs){let s=new L(i,e);this.buffs.push(s)}if(a.globalBuffs)for(let i of a.globalBuffs){let s=new L(i,e);this.buffs.push(s)}}},Ke=Ee;var Ve=S("achievementTierDetailMap");var je=S("achievementDetailMap");var xe=class{constructor(t){this.achievements=t,this.buffs=[];for(let e of Object.values(Ve)){let a=!0,i=Object.values(je).filter(s=>s.tierHrid==e.hrid);for(let s of Object.values(i))if(!this.achievements[s.hrid]||this.achievements[s.hrid]==!1){a=!1;break}if(a){let s=new L(e.buff);this.buffs.push(s)}}}},Ze=xe;var Re=class n extends Lt{constructor(){super();p(this,"equipment",{"/equipment_types/head":null,"/equipment_types/body":null,"/equipment_types/legs":null,"/equipment_types/feet":null,"/equipment_types/hands":null,"/equipment_types/main_hand":null,"/equipment_types/two_hand":null,"/equipment_types/off_hand":null,"/equipment_types/pouch":null,"/equipment_types/back":null});this.isPlayer=!0,this.hrid="player"}static createFromDTO(e){let a=new n;a.staminaLevel=e.staminaLevel,a.intelligenceLevel=e.intelligenceLevel,a.attackLevel=e.attackLevel,a.meleeLevel=e.meleeLevel,a.defenseLevel=e.defenseLevel,a.rangedLevel=e.rangedLevel,a.magicLevel=e.magicLevel,a.hrid=e.hrid;for(let[i,s]of Object.entries(e.equipment))a.equipment[i]=s?We.createFromDTO(s):null;return a.food=e.food.map(i=>i?_e.createFromDTO(i):null),a.drinks=e.drinks.map(i=>i?_e.createFromDTO(i):null),a.abilities=e.abilities.map(i=>i?W.createFromDTO(i):null),Object.entries(e.houseRooms).forEach(i=>{i[1]>0&&a.houseRooms.push(new Ke(i[0],i[1]))}),a.achievements=new Ze(e.achievements),a.debuffOnLevelGap=e.debuffOnLevelGap,a}updateCombatDetails(){this.equipment["/equipment_types/main_hand"]?(this.combatDetails.combatStats.combatStyleHrid=this.equipment["/equipment_types/main_hand"].getCombatStyle(),this.combatDetails.combatStats.damageType=this.equipment["/equipment_types/main_hand"].getDamageType(),this.combatDetails.combatStats.attackInterval=this.equipment["/equipment_types/main_hand"].getCombatStat("attackInterval"),this.combatDetails.combatStats.primaryTraining=this.equipment["/equipment_types/main_hand"].getPrimaryTraining()):this.equipment["/equipment_types/two_hand"]?(this.combatDetails.combatStats.combatStyleHrid=this.equipment["/equipment_types/two_hand"].getCombatStyle(),this.combatDetails.combatStats.damageType=this.equipment["/equipment_types/two_hand"].getDamageType(),this.combatDetails.combatStats.attackInterval=this.equipment["/equipment_types/two_hand"].getCombatStat("attackInterval"),this.combatDetails.combatStats.primaryTraining=this.equipment["/equipment_types/two_hand"].getPrimaryTraining()):(this.combatDetails.combatStats.combatStyleHrid="/combat_styles/smash",this.combatDetails.combatStats.damageType="/damage_types/physical",this.combatDetails.combatStats.attackInterval=3e9,this.combatDetails.combatStats.primaryTraining="/skills/melee"),this.equipment["/equipment_types/charm"]?this.combatDetails.combatStats.focusTraining=this.equipment["/equipment_types/charm"].getFocusTraining():this.combatDetails.combatStats.focusTraining="",["stabAccuracy","slashAccuracy","smashAccuracy","rangedAccuracy","magicAccuracy","stabDamage","slashDamage","smashDamage","rangedDamage","magicDamage","defensiveDamage","taskDamage","physicalAmplify","waterAmplify","natureAmplify","fireAmplify","healingAmplify","stabEvasion","slashEvasion","smashEvasion","rangedEvasion","magicEvasion","armor","waterResistance","natureResistance","fireResistance","maxHitpoints","maxManapoints","lifeSteal","hpRegenPer10","mpRegenPer10","physicalThorns","elementalThorns","combatDropRate","combatRareFind","combatDropQuantity","combatExperience","criticalRate","criticalDamage","armorPenetration","waterPenetration","naturePenetration","firePenetration","abilityHaste","tenacity","manaLeech","castSpeed","threat","parry","mayhem","pierce","curse","fury","weaken","ripple","bloom","blaze","attackSpeed","foodHaste","drinkConcentration","autoAttackDamage","abilityDamage","staminaExperience","intelligenceExperience","attackExperience","defenseExperience","meleeExperience","rangedExperience","magicExperience","retaliation"].forEach(e=>{this.combatDetails.combatStats[e]=Object.values(this.equipment).filter(a=>a!=null).map(a=>a.getCombatStat(e)).reduce((a,i)=>a+i,0)}),this.equipment["/equipment_types/pouch"]?(this.combatDetails.combatStats.foodSlots=1+this.equipment["/equipment_types/pouch"].getCombatStat("foodSlots"),this.combatDetails.combatStats.drinkSlots=1+this.equipment["/equipment_types/pouch"].getCombatStat("drinkSlots")):(this.combatDetails.combatStats.foodSlots=1,this.combatDetails.combatStats.drinkSlots=1),super.updateCombatDetails()}},He=Re;var Ye=S("actionDetailMap");var Be=class{constructor(t,e){this.hrid=t,this.difficultyTier=e;let a=Ye[this.hrid];this.monsterSpawnInfo=a.combatZoneInfo.fightInfo,this.dungeonSpawnInfo=a.combatZoneInfo.dungeonInfo,this.encountersKilled=1,this.monsterSpawnInfo.battlesPerBoss=10,this.buffs=a.buffs,this.isDungeon=a.combatZoneInfo.isDungeon,this.dungeonsCompleted=0,this.dungeonsFailed=0,this.finalWave=!1}getRandomEncounter(){if(this.monsterSpawnInfo.bossSpawns&&this.encountersKilled==this.monsterSpawnInfo.battlesPerBoss)return this.encountersKilled=1,this.monsterSpawnInfo.bossSpawns.map(i=>new O(i.combatMonsterHrid,i.difficultyTier+this.difficultyTier));let t=this.monsterSpawnInfo.randomSpawnInfo.spawns.reduce((i,s)=>i+s.rate,0),e=[],a=0;t:for(let i=0;i<this.monsterSpawnInfo.randomSpawnInfo.maxSpawnCount;i++){let s=t*Math.random(),r=0;for(let o of this.monsterSpawnInfo.randomSpawnInfo.spawns)if(r+=o.rate,s<=r){if(a+=o.strength,a<=this.monsterSpawnInfo.randomSpawnInfo.maxTotalStrength)e.push({hrid:o.combatMonsterHrid,difficultyTier:o.difficultyTier});else break t;break}}return this.encountersKilled++,e.map(i=>new O(i.hrid,i.difficultyTier+this.difficultyTier))}failWave(){this.dungeonsFailed++,this.encountersKilled=1}getNextWave(){if(this.encountersKilled>this.dungeonSpawnInfo.maxWaves&&(this.dungeonsCompleted++,this.encountersKilled=1),this.dungeonSpawnInfo.fixedSpawnsMap.hasOwnProperty(this.encountersKilled.toString())){let t=this.dungeonSpawnInfo.fixedSpawnsMap[this.encountersKilled.toString()];return this.encountersKilled++,t.map(e=>new O(e.combatMonsterHrid,e.difficultyTier+this.difficultyTier))}else{let t={},e=Object.keys(this.dungeonSpawnInfo.randomSpawnInfoMap).map(Number).sort((r,o)=>r-o);if(this.encountersKilled>e[e.length-1])t=this.dungeonSpawnInfo.randomSpawnInfoMap[e[e.length-1]];else for(let r=0;r<e.length-1;r++)if(this.encountersKilled>=e[r]&&this.encountersKilled<=e[r+1]){t=this.dungeonSpawnInfo.randomSpawnInfoMap[e[r]];break}let a=t.spawns.reduce((r,o)=>r+o.rate,0),i=[],s=0;t:for(let r=0;r<t.maxSpawnCount;r++){let o=a*Math.random(),c=0;for(let l of t.spawns)if(c+=l.rate,o<=c){if(s+=l.strength,s<=t.maxTotalStrength)i.push({hrid:l.combatMonsterHrid,difficultyTier:l.difficultyTier});else break t;break}}return this.encountersKilled++,i.map(r=>new O(r.hrid,r.difficultyTier+this.difficultyTier))}}},$e=Be;var Xe=S("labyrinthCrateDetailMap");var Me=class{constructor(t,e,a=[]){if(this.monsterHrid=t,this.roomLevel=e,this.buffs=[],a)for(let i of a)this.buffs=this.buffs.concat(Xe[i]);this.attemptCount=0}getMonster(){return this.attemptCount++,[new O(this.monsterHrid,0,this.roomLevel)]}updateEnconterStartTime(t){this.enconterStartTime=t}checkTimeout(t){return t-this.enconterStartTime>120*1e9}},Je=Me;var ta=2e3,A=null;function It(n){let t=A.data.abilities;return t[n]||(t[n]={casts:0,blocked:0,enemiesAtCast:{},hits:0,hitDamage:0,kills:[],healed:0,overheal:0,heals:0,healSamples:[]})}function Da(n){var t;return(t=A.data.consumables)[n]||(t[n]={uses:0,restore:0,wasted:0})}var va=n=>(n||[]).filter(t=>t&&t.combatDetails.currentHitpoints>0).length,ea=!1;function Ta(){if(ea)return;ea=!0;let n=ut.prototype,t=n.canUseAbility;n.canUseAbility=function(c,l,h){let m=t.call(this,c,l,h);return A&&!m&&h&&c.isPlayer&&c.combatDetails.currentHitpoints>0&&c.combatDetails.currentManapoints<l.manaCost&&It(l.hrid).blocked++,m};let e=n.tryUseAbility;n.tryUseAbility=function(c,l){if(!A||!c.isPlayer)return e.call(this,c,l);let h=c.combatDetails.currentManapoints,m=va(this.enemies);A.casting=l.hrid;try{let f=e.call(this,c,l);if(f||c.combatDetails.currentManapoints<h){let u=It(l.hrid);u.casts++,u.enemiesAtCast[m]=(u.enemiesAtCast[m]||0)+1}return f}finally{A.casting=null}};let a=n.startNewEncounter;n.startNewEncounter=function(...c){let l=a.apply(this,c);return A&&(A.data.maxEnemies=Math.max(A.data.maxEnemies,(this.enemies||[]).length)),l};let i=n.tryUseConsumable;n.tryUseConsumable=function(c,l){if(!A||!c.isPlayer||c.combatDetails.currentHitpoints<=0)return i.call(this,c,l);let h=c.combatDetails,m=h.maxHitpoints-h.currentHitpoints,f=h.maxManapoints-h.currentManapoints,u=i.call(this,c,l);if(u){let g=Da(l.hrid);g.uses++;let b=l.hitpointRestore||0,T=l.manapointRestore||0;g.restore+=b+T,g.wasted+=Math.max(0,b-m)+Math.max(0,T-f)}return u};let s=_.processAttack;_.processAttack=function(c,l,h=null){if(!A||!A.casting||!h||!c.isPlayer||l.isPlayer)return s.call(this,c,l,h);let m=l.combatDetails.currentHitpoints,f=s.call(this,c,l,h);if(f.didHit){let u=It(A.casting);l.combatDetails.currentHitpoints<=0?u.kills.length<ta&&u.kills.push(m):(u.hits++,u.hitDamage+=f.damageDone)}return f};let r=X.prototype.addDeath;X.prototype.addDeath=function(c){if(A&&c===A.player){let l=A.simulator.simulationTime;A.data.deaths++,(c.food||[]).some(h=>h&&h.hitpointRestore>0&&h.lastUsed+h.cooldownDuration>l)&&A.data.deathsFoodWaiting++}return r.call(this,c)};let o=_.processHeal;_.processHeal=function(c,l,h){if(!A||!A.casting||!c.isPlayer)return o.call(this,c,l,h);let m=h.combatDetails.maxHitpoints-h.combatDetails.currentHitpoints,f=o.call(this,c,l,h),u=It(A.casting);return u.heals++,u.healed+=f,f<m?u.healSamples.length<ta&&u.healSamples.push(f):u.overheal++,f}}async function aa(n,t,e){Ta();let a={abilities:{},consumables:{},maxEnemies:0,deaths:0,deathsFoodWaiting:0};A={simulator:n,player:t,data:a,casting:null};try{return[await e(),a]}finally{A=null}}var ia=36e11,Sa=12e10;function sa(n){let t=n|0;return function(){t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function ke(n,t){let e={};for(let[a,i]of Object.entries(n||{}))e[a]=i/t;return e}async function ra(n){let t=Math.random;Math.random=sa(n.seed);try{let e=new $e(n.zoneHrid,n.tier),a=He.createFromDTO(structuredClone(n.player));a.zoneBuffs=e.buffs||[],a.extraBuffs=n.extraBuffs||[];let i=new ut([a],e,null,{}),s=()=>i.simulate(n.hours*ia),[r,o]=n.telemetry?await aa(i,a,s):[await s(),null],c=r.simulatedTime/ia,l={};for(let[m,f]of Object.entries(r.deaths))m!=="player1"&&(l[m]=f/c);let h=ke(r.experienceGained.player1,c);return{hours:c,xp:h,xpTotal:Object.values(h).reduce((m,f)=>m+f,0),deaths:(r.deaths.player1||0)/c,encounters:r.encounters/c,kills:l,consumables:ke(r.consumablesUsed.player1,c),manaUsed:ke(r.manaUsed?.player1,c),dropRateMultiplier:r.dropRateMultiplier.player1??1,rareFindMultiplier:r.rareFindMultiplier.player1??1,combatDropQuantity:r.combatDropQuantity.player1??0,...o?{telemetry:{...o,hours:c}}:{}}}finally{Math.random=t}}async function na(n){let t=Math.random;Math.random=sa(n.seed);try{let e=new Je(n.monsterHrid,n.roomLevel,[]),a=He.createFromDTO(structuredClone(n.player));a.zoneBuffs=[],a.extraBuffs=n.extraBuffs||[];let i=new ut([a],null,e,{}),s={attempts:0,wins:0,deaths:0,timeouts:0,winSeconds:[]},r=null,o=()=>{if(!r)return;let u=i.simResult.deaths;(u[n.monsterHrid]||0)>r.kills?(s.wins++,s.winSeconds.push((i.simulationTime-r.start)/1e9)):(u.player1||0)>r.died?s.deaths++:s.timeouts++,s.attempts++,r=null},c=e.getMonster.bind(e);e.getMonster=()=>{o();let u=i.simResult.deaths;return r={start:i.simulationTime,kills:u[n.monsterHrid]||0,died:u.player1||0},c()};let l=i.processEvent.bind(i);i.processEvent=async u=>{await l(u),s.attempts>=n.attempts&&(i.simulationTime=1/0)},await i.simulate((n.attempts+1)*Sa),s.winSeconds.sort((u,g)=>u-g);let h=u=>s.winSeconds.length?s.winSeconds[Math.min(s.winSeconds.length-1,Math.floor(u*s.winSeconds.length))]:null,{winSeconds:m,...f}=s;return{...f,medianWinSeconds:h(.5),slowWinSeconds:h(.9)}}finally{Math.random=t}}self.onmessage=async n=>{let t=n.data;if(t.type==="init"){Ie(t.data),self.postMessage({type:"ready"});return}if(t.type==="sim")try{let e=t.job.monsterHrid?await na(t.job):await ra(t.job);self.postMessage({type:"result",id:t.id,result:e})}catch(e){self.postMessage({type:"error",id:t.id,error:String(e?.stack||e)})}};})();\n';

  // src/game-state.js
  var INTERESTING = new RegExp(
    '"type":"(' + [
      "init_character_data",
      "items_updated",
      "action_completed",
      "abilities_updated",
      "skills_updated",
      "character_stats_updated",
      "action_type_consumable_slots_updated",
      "all_combat_triggers_updated",
      "combat_triggers_updated",
      "actions_updated",
      "achievements_updated",
      "community_buffs_updated",
      "moo_pass_buffs_updated",
      "personal_buffs_updated",
      "guild_buffs_updated",
      "house_rooms_updated",
      "achievement_buffs_updated",
      "consumable_buffs_updated",
      "equipment_buffs_updated",
      "market_listings_updated",
      "market_item_order_books_updated",
      "loot_log_updated",
      "loadouts_updated",
      "labyrinth_updated",
      "character_info_updated",
      "setting_updated"
    ].join("|") + ')"'
  );
  var BUFF_MAPS = [
    "mooPassActionTypeBuffsMap",
    "communityActionTypeBuffsMap",
    "houseActionTypeBuffsMap",
    "guildActionTypeBuffsMap",
    "achievementActionTypeBuffsMap",
    "consumableActionTypeBuffsMap",
    "equipmentActionTypeBuffsMap",
    "personalActionTypeBuffsMap"
  ];
  var listeners = /* @__PURE__ */ new Set();
  var BOOKS_KEY = "mwia-order-books";
  var BOOK_MAX_AGE_MS = 24 * 3600 * 1e3;
  var MAX_BOOKS = 150;
  function loadOrderBooks() {
    try {
      const saved = JSON.parse(localStorage.getItem(BOOKS_KEY) || "{}");
      return new Map(Object.entries(saved).filter(([, book]) => Date.now() - book.at < BOOK_MAX_AGE_MS));
    } catch {
      return /* @__PURE__ */ new Map();
    }
  }
  function saveOrderBooks() {
    const newest = [...state.orderBooks].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_BOOKS);
    state.orderBooks = new Map(newest);
    try {
      localStorage.setItem(BOOKS_KEY, JSON.stringify(Object.fromEntries(newest)));
    } catch {
    }
  }
  var normalizeOrder = (order) => Array.isArray(order) ? { price: Number(order[0]) || 0, quantity: Number(order[1]) || 0 } : { price: Number(order?.price) || 0, quantity: Number(order?.quantity ?? (order?.orderQuantity ?? 0) - (order?.filledQuantity ?? 0)) || 0 };
  function applyOrderBook(data) {
    const payload = data.marketItemOrderBooks ?? data;
    if (!payload.itemHrid || !payload.orderBooks) return;
    const sides = (book) => ({
      asks: (book?.asks || []).map(normalizeOrder).filter((o2) => o2.quantity > 0),
      bids: (book?.bids || []).map(normalizeOrder).filter((o2) => o2.quantity > 0)
    });
    const levels = {};
    const seen = [];
    for (const [level, book] of Object.entries(payload.orderBooks)) {
      if (!book) continue;
      seen.push(Number(level));
      const both = sides(book);
      if (Number(level) > 0 && (both.asks.length || both.bids.length)) levels[Number(level)] = both;
    }
    const bands = {};
    for (const level of /* @__PURE__ */ new Set([...Object.keys(payload.priceBandMins || {}), ...Object.keys(payload.priceBandMaxs || {})])) {
      const max = Number(payload.priceBandMaxs?.[level]) || 0;
      bands[Number(level)] = { min: Number(payload.priceBandMins?.[level]) || 0, max: max > 0 ? max : null };
    }
    state.orderBooks.set(payload.itemHrid, { at: Date.now(), ...sides(payload.orderBooks[0] ?? payload.orderBooks["0"]), levels, seen, bands });
    saveOrderBooks();
  }
  function orderBookAt(itemHrid, level = 0) {
    const entry = state.orderBooks.get(itemHrid);
    if (!entry || level && !entry.seen?.includes(level)) return null;
    const both = level ? entry.levels[level] || { asks: [], bids: [] } : entry;
    const band = entry.bands?.[level];
    return { at: entry.at, asks: both.asks, bids: both.bids, range: band ? { min: band.min, max: band.max ?? Infinity } : null };
  }
  var listingDone = (listing) => !!(listing.isDone || listing.isCancelled || listing.isCanceled || listing.isExpired) || /(cancel|complete|expire|closed|done)/i.test(String(listing.status ?? ""));
  function applyListings(data) {
    const full = data.myMarketListings ?? data.marketListings;
    if (Array.isArray(full)) {
      state.character.myMarketListings = full.filter((listing) => !listingDone(listing));
      return;
    }
    const listings = [...state.character.myMarketListings || []];
    for (const listing of data.endMarketListings || []) {
      const index = listings.findIndex((other) => other.id === listing.id);
      if (index >= 0) listings.splice(index, 1);
      if (!listingDone(listing)) listings.push(listing);
    }
    state.character.myMarketListings = listings;
  }
  var state = {
    character: null,
    // the latest init_character_data, patched by later messages
    items: /* @__PURE__ */ new Map(),
    // hash/id -> character item
    lootLog: null,
    // the game's Loot & XP Log, as last sent
    labyrinth: null,
    // the Labyrinth run, as last sent: { isActive, currentFloor, roomData: rows of { roomType, monsterHrid, recommendedLevel, isCleared } or null (fog) }
    orderBooks: loadOrderBooks(),
    // itemHrid -> { at, asks, bids (+0), levels: { level: { asks, bids } }, seen: [levels sent], bands: { level: { min, max } } }, from viewing it on the market
    updatedAt: 0
  };
  function onStateChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  function itemKey(item) {
    if (item.hash) return "h:" + item.hash;
    if (item.id !== void 0 && item.id !== null) return "i:" + item.id;
    return `x:${item.itemHrid}:${item.itemLocationHrid}:${item.enhancementLevel || 0}`;
  }
  function itemChanges(updates) {
    const changes = [];
    for (const item of updates || []) {
      if (!item) continue;
      const prev = state.items.get(itemKey(item));
      const before = prev?.count ?? 0;
      const after = item.count ?? before;
      if (after === before) continue;
      changes.push({ itemHrid: item.itemHrid ?? prev?.itemHrid, level: Number(item.enhancementLevel ?? prev?.enhancementLevel) || 0, location: item.itemLocationHrid ?? prev?.itemLocationHrid, delta: after - before });
    }
    return changes;
  }
  function applyItems(updates) {
    for (const item of updates || []) {
      if (!item) continue;
      const key2 = itemKey(item);
      if (item.count === 0) state.items.delete(key2);
      else state.items.set(key2, item.hash ? item : { ...state.items.get(key2) || {}, ...item });
    }
  }
  function mergeAbilities(updates) {
    if (!state.character || !Array.isArray(updates)) return;
    const abilities = [...state.character.characterAbilities || []];
    for (const updated of updates) {
      const index = abilities.findIndex((a) => a.abilityHrid === updated.abilityHrid);
      if (index === -1) abilities.push(updated);
      else abilities[index] = updated;
    }
    state.character.characterAbilities = abilities;
  }
  function mergeSkills(updates) {
    if (!state.character || !Array.isArray(updates)) return;
    const skills = state.character.characterSkills || [];
    for (const updated of updates) {
      const skill = skills.find((s2) => s2.skillHrid === updated.skillHrid);
      if (skill) Object.assign(skill, updated);
      else skills.push(updated);
    }
    state.character.characterSkills = skills;
  }
  function mergeActions(updates) {
    if (!state.character || !Array.isArray(updates)) return;
    let actions = [...state.character.characterActions || []];
    for (const action of updates) {
      actions = actions.filter((a) => a.id !== action.id);
      if (!action.isDone) actions.push(action);
    }
    actions.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
    state.character.characterActions = actions;
  }
  function copyFields(data, fields) {
    for (const field of fields) {
      if (data[field] !== void 0) state.character[field] = data[field];
    }
  }
  function handle(data) {
    const extra = {};
    if (data.type === "init_character_data") {
      state.character = data;
      state.labyrinth = data.labyrinth || null;
      state.items = /* @__PURE__ */ new Map();
      applyItems(data.characterItems);
    } else if (data.type === "market_item_order_books_updated") {
      applyOrderBook(data);
    } else if (!state.character) {
      return;
    } else {
      switch (data.type) {
        case "items_updated":
          extra.changes = itemChanges(data.endCharacterItems);
          applyItems(data.endCharacterItems);
          break;
        case "action_completed":
          extra.changes = itemChanges(data.endCharacterItems);
          applyItems(data.endCharacterItems);
          if (data.endCharacterAction) mergeActions([data.endCharacterAction]);
          mergeSkills(data.endCharacterSkills);
          mergeAbilities(data.endCharacterAbilities);
          break;
        case "abilities_updated":
          mergeAbilities(data.endCharacterAbilities);
          break;
        case "skills_updated":
          if (data.characterSkills) state.character.characterSkills = data.characterSkills;
          mergeSkills(data.endCharacterSkills);
          break;
        case "character_stats_updated":
          copyFields(data, ["combatUnit", "noncombatStats"]);
          break;
        case "action_type_consumable_slots_updated":
          copyFields(data, ["actionTypeFoodSlotsMap", "actionTypeDrinkSlotsMap", ...BUFF_MAPS]);
          break;
        case "all_combat_triggers_updated":
          copyFields(data, ["abilityCombatTriggersMap", "consumableCombatTriggersMap"]);
          break;
        case "combat_triggers_updated":
          if (data.combatTriggerTypeHrid === "/combat_trigger_types/ability" && data.abilityHrid) {
            state.character.abilityCombatTriggersMap = {
              ...state.character.abilityCombatTriggersMap || {},
              [data.abilityHrid]: data.combatTriggers
            };
          } else if (data.itemHrid) {
            state.character.consumableCombatTriggersMap = {
              ...state.character.consumableCombatTriggersMap || {},
              [data.itemHrid]: data.combatTriggers
            };
          }
          break;
        case "house_rooms_updated":
          copyFields(data, ["characterHouseRoomMap", ...BUFF_MAPS]);
          break;
        case "market_listings_updated":
          applyListings(data);
          break;
        case "loot_log_updated":
          if (Array.isArray(data.lootLog)) state.lootLog = data.lootLog;
          break;
        case "actions_updated":
          mergeActions(data.endCharacterActions);
          break;
        case "achievements_updated":
          copyFields(data, ["characterAchievements"]);
          break;
        case "character_info_updated":
          copyFields(data, ["characterInfo"]);
          break;
        case "setting_updated":
          copyFields(data, ["characterSetting"]);
          break;
        case "labyrinth_updated":
          state.labyrinth = data.labyrinth || null;
          break;
        case "loadouts_updated":
          copyFields(data, ["characterLoadoutMap"]);
          break;
        case "community_buffs_updated":
        case "moo_pass_buffs_updated":
        case "personal_buffs_updated":
        case "guild_buffs_updated":
        case "achievement_buffs_updated":
        case "consumable_buffs_updated":
        case "equipment_buffs_updated":
          copyFields(data, BUFF_MAPS);
          break;
      }
    }
    state.updatedAt = Date.now();
    for (const listener of listeners) {
      try {
        listener(data.type, data, extra);
      } catch (error) {
        console.error("[MWI Advisor]", error);
      }
    }
  }
  var LAB_KEY = "mwia-laby-log";
  var LAB_KEEP = 40;
  var LAB_MAX = 3e4;
  var LAB_PER_TYPE = 5;
  var LAB_SKIP = /"type":"(init_character_data|init_client_data)"/;
  var labLog = null;
  function labyrinthMessages() {
    if (!labLog) {
      try {
        labLog = JSON.parse(localStorage.getItem(LAB_KEY) || "[]");
      } catch {
        labLog = [];
      }
    }
    return labLog;
  }
  function keepLabyrinth(raw) {
    if (!/labyrinth/i.test(raw) || LAB_SKIP.test(raw.slice(0, 200))) return;
    const type = /"type":"([^"]+)"/.exec(raw)?.[1] || "?";
    const log2 = labyrinthMessages();
    const same2 = log2.filter((m2) => m2.type === type);
    if (same2.length >= LAB_PER_TYPE) log2.splice(log2.indexOf(same2[0]), 1);
    log2.push({ at: Date.now(), type, size: raw.length, raw: raw.slice(0, LAB_MAX) });
    while (log2.length > LAB_KEEP) log2.shift();
    try {
      localStorage.setItem(LAB_KEY, JSON.stringify(log2));
    } catch {
      log2.splice(0, Math.ceil(log2.length / 2));
      try {
        localStorage.setItem(LAB_KEY, JSON.stringify(log2));
      } catch {
      }
    }
  }
  function onMessage(event) {
    const raw = event.data;
    if (typeof raw === "string") {
      try {
        keepLabyrinth(raw);
      } catch {
      }
    }
    if (typeof raw !== "string" || !INTERESTING.test(raw)) return;
    try {
      handle(JSON.parse(raw));
    } catch (error) {
      console.error("[MWI Advisor] Could not parse message", error);
    }
  }
  function isGameSocket(url) {
    return /milkywayidle(cn)?\.com\/ws/.test(String(url));
  }
  function installSocketHook(win2) {
    const NativeWebSocket = win2.WebSocket;
    if (!NativeWebSocket || NativeWebSocket.__mwiaHooked) return;
    const Hooked = new Proxy(NativeWebSocket, {
      construct(target, args, newTarget) {
        const socket = Reflect.construct(target, args, newTarget === Hooked ? target : newTarget);
        if (isGameSocket(args[0])) socket.addEventListener("message", onMessage);
        return socket;
      },
      get(target, property, receiver) {
        if (property === "__mwiaHooked") return true;
        return Reflect.get(target, property, target);
      }
    });
    win2.WebSocket = Hooked;
  }

  // src/buy-limits.js
  var OLD_MS = 12 * 3600 * 1e3;
  var s = { jobs: [], at: 0, preferred: null };
  function setBuyLimits(jobs, now2 = Date.now()) {
    s.jobs = jobs;
    s.at = now2;
  }
  function preferBuyLimits(actionHrid) {
    s.preferred = actionHrid || null;
  }
  function buyLimit(itemHrid, now2 = Date.now()) {
    if (!s.jobs.length || now2 - s.at > OLD_MS) return null;
    const using = s.jobs.filter((job2) => job2.inputs.some((i) => i.itemHrid === itemHrid));
    const job = using.find((j2) => j2.hrid === s.preferred) || using[0];
    if (!job) return null;
    const input = job.inputs.find((i) => i.itemHrid === itemHrid);
    return Number.isFinite(input.limitPrice) ? { price: input.limitPrice, margin: input.margin, job: job.name, at: s.at } : null;
  }

  // src/data-shim.js
  var store = globalThis.__MWIA_DATA || (globalThis.__MWIA_DATA = {});
  var ENGINE_TABLES = [
    "abilityDetailMap",
    "achievementDetailMap",
    "achievementTierDetailMap",
    "actionDetailMap",
    "combatMonsterDetailMap",
    "combatStyleDetailMap",
    "combatTriggerDependencyDetailMap",
    "enhancementLevelTotalBonusMultiplierTable",
    "houseRoomDetailMap",
    "itemDetailMap",
    "labyrinthCrateDetailMap"
  ];

  // src/game-data.js
  var FALLBACK_DATA_URL = "https://raw.githubusercontent.com/shykai/MWICombatSimulatorTest/dev/src/combatsimulator/data/";
  var PRICE_TTL_MS = 30 * 60 * 1e3;
  var clientData = null;
  var prices = null;
  var pricesFetchedAt = 0;
  function readClientData(win2) {
    try {
      const util = win2.localStorageUtil;
      if (util && typeof util.getInitClientData === "function") {
        const data = util.getInitClientData();
        if (data && data.itemDetailMap) return data;
      }
    } catch (error) {
      console.warn("[MWI Advisor] localStorageUtil failed", error);
    }
    return null;
  }
  async function loadClientData(win2) {
    if (clientData) return clientData;
    const data = readClientData(win2);
    if (!data) throw new Error("Game data not found yet. Wait for the game to finish loading and try again.");
    for (const table of [...ENGINE_TABLES, "abilitySlotsLevelRequirementList"]) {
      if (data[table]) continue;
      try {
        const response = await fetch(FALLBACK_DATA_URL + table + ".json");
        if (response.ok) data[table] = await response.json();
      } catch (error) {
        console.warn("[MWI Advisor] Could not fetch", table, error);
      }
      if (!data[table]) data[table] = table === "abilitySlotsLevelRequirementList" ? [0, 1, 1, 20, 50, 90] : {};
    }
    clientData = data;
    return clientData;
  }
  function getClientData() {
    return clientData;
  }
  function engineTables() {
    const tables = {};
    for (const table of ENGINE_TABLES) tables[table] = clientData[table];
    return tables;
  }
  var priceListeners = /* @__PURE__ */ new Set();
  function onPricesLoaded(listener) {
    priceListeners.add(listener);
  }
  async function loadPrices(force = false) {
    if (prices && !force && Date.now() - pricesFetchedAt < PRICE_TTL_MS) return prices;
    const response = await fetch("/game_data/marketplace.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not fetch market prices (" + response.status + ")");
    const json = await response.json();
    prices = json.marketData || {};
    pricesFetchedAt = Date.now();
    for (const listener of priceListeners) {
      try {
        listener(prices, json.timestamp);
      } catch (error) {
        console.error("[MWI Advisor]", error);
      }
    }
    return prices;
  }
  function pricesAge() {
    return pricesFetchedAt ? Date.now() - pricesFetchedAt : null;
  }
  function marketEntry(itemHrid, enhancementLevel = 0) {
    return prices?.[itemHrid]?.[String(enhancementLevel)] || null;
  }
  function pricesStamp() {
    return pricesFetchedAt;
  }
  function askPrice(itemHrid, enhancementLevel = 0) {
    if (itemHrid === "/items/coin") return 1;
    const entry = prices?.[itemHrid]?.[String(enhancementLevel)];
    return entry && entry.a > 0 ? entry.a : null;
  }
  function marketListings(itemHrid) {
    return Object.entries(prices?.[itemHrid] || {}).filter(([, entry]) => entry.a > 0).map(([level, entry]) => ({ enhancementLevel: Number(level), price: entry.a, bid: entry.b > 0 ? entry.b : null })).sort((a, b) => a.price - b.price);
  }
  function marketBids(itemHrid) {
    return Object.entries(prices?.[itemHrid] || {}).filter(([, entry]) => entry.b > 0).map(([level, entry]) => ({ enhancementLevel: Number(level), bid: entry.b }));
  }
  function sellValue(itemHrid) {
    if (itemHrid === "/items/coin") return 1;
    const entry = prices?.[itemHrid]?.["0"];
    if (entry && entry.b > 0) return entry.b;
    return clientData?.itemDetailMap?.[itemHrid]?.sellPrice || 0;
  }
  function itemName(hrid) {
    return clientData?.itemDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
  }
  function abilityName(hrid) {
    return clientData?.abilityDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
  }
  function actionName(hrid) {
    return clientData?.actionDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
  }
  function monsterName(hrid) {
    return clientData?.combatMonsterDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
  }
  function combatZones() {
    return Object.values(clientData.actionDetailMap).filter(
      (action) => action.type === "/action_types/combat" && !action.combatZoneInfo?.isDungeon && action.combatZoneInfo?.fightInfo?.randomSpawnInfo
    ).sort((a, b) => a.sortIndex - b.sortIndex);
  }
  function expectedLootPerKill(monsterHrid, tier, sim) {
    const monster = clientData.combatMonsterDetailMap[monsterHrid];
    if (!monster) return 0;
    let value = 0;
    const quantity = 1 + (sim.combatDropQuantity || 0);
    for (const drop of monster.dropTable || []) {
      if (drop.minDifficultyTier > tier) continue;
      const rate2 = Math.min(1, (1 + 0.1 * tier) * (drop.dropRate + (drop.dropRatePerDifficultyTier ?? 0) * tier));
      if (rate2 <= 0) continue;
      const finalRate = Math.min(1, rate2 * (sim.dropRateMultiplier || 1));
      value += finalRate * ((drop.minCount + drop.maxCount) / 2) * quantity * sellValue(drop.itemHrid);
    }
    for (const drop of monster.rareDropTable || []) {
      if (drop.minDifficultyTier > tier) continue;
      const finalRate = drop.dropRate * (sim.rareFindMultiplier || 1);
      value += finalRate * ((drop.minCount + drop.maxCount) / 2) * quantity * sellValue(drop.itemHrid);
    }
    return value;
  }

  // src/levels.js
  var LEVEL_HORIZON_HOURS = 24;
  function fractionalLevel(table, xp) {
    let low = 1;
    let high = table.length - 1;
    if (xp >= table[high]) return high;
    while (high - low > 1) {
      const mid = low + high >> 1;
      if (table[mid] <= xp) low = mid;
      else high = mid;
    }
    return low + (xp - table[low]) / Math.max(1, table[low + 1] - table[low]);
  }
  function experienceOf(table, experience, level) {
    return Math.max(Number(experience) || 0, table[level] ?? 0);
  }
  function levelsPerDay(table, xpNow, xpPerDay) {
    if (!(xpPerDay > 0)) return 0;
    return fractionalLevel(table, xpNow + xpPerDay) - fractionalLevel(table, xpNow);
  }
  function levelsPerHour(table, skills, xpPerHour, hours = LEVEL_HORIZON_HOURS) {
    let levels = 0;
    for (const [key2, rate2] of Object.entries(xpPerHour || {})) {
      const skill = skills[key2];
      if (!skill || !(rate2 > 0)) continue;
      const now2 = experienceOf(table, skill.xp, skill.level);
      levels += fractionalLevel(table, now2 + rate2 * hours) - fractionalLevel(table, now2);
    }
    return levels / hours;
  }
  function xpToNextLevel(table, xpNow, level) {
    return table[level + 1] === void 0 ? null : Math.max(0, table[level + 1] - xpNow);
  }
  function nextPouchGoal(totalLevel, data) {
    let best = null;
    for (const item of Object.values(data.itemDetailMap || {})) {
      if (item.equipmentDetail?.type !== "/equipment_types/pouch") continue;
      const need = (item.equipmentDetail.levelRequirements || []).find((r) => r.skillHrid === "/skills/total_level")?.level;
      if (need > totalLevel && (!best || need < best.level || need === best.level && item.sortIndex < best.sortIndex)) {
        best = { level: need, hrid: item.hrid, sortIndex: item.sortIndex ?? 0 };
      }
    }
    return best;
  }

  // src/alchemy.js
  var ALCHEMY = "alchemy";
  var TYPE = "/action_types/alchemy";
  var SKILL = "/skills/alchemy";
  var ALCHEMY_FUNCTION = "/action_functions/alchemy";
  var BASE_SECONDS = 20;
  var MIN_CYCLE_SECONDS = 3;
  var FAIL_XP = 0.1;
  var COIN = "/items/coin";
  var ESSENCE = "/items/alchemy_essence";
  var ENHANCING_ESSENCE = "/items/enhancing_essence";
  var ALCHEMY_KINDS = {
    coinify: { name: "Coinify", hrid: "/actions/alchemy/coinify", rate: 0.7, xp: 1, catalyst: "/items/catalyst_of_coinification" },
    decompose: { name: "Decompose", hrid: "/actions/alchemy/decompose", rate: 0.6, xp: 1.4, catalyst: "/items/catalyst_of_decomposition" },
    transmute: { name: "Transmute", hrid: "/actions/alchemy/transmute", rate: null, xp: 1.6, catalyst: "/items/catalyst_of_transmutation" }
  };
  var PRIME = "/items/prime_catalyst";
  var CATALYST_BONUS = { kind: 0.15, prime: 0.25 };
  function levelPenalty(level, itemLevel) {
    return level < itemLevel && itemLevel > 0 ? 0.9 / itemLevel * (level - itemLevel) : 0;
  }
  function coinCost(kind, detail) {
    const bulk = bulkOf(detail);
    if (kind === "decompose") return 5 * (10 + (detail.itemLevel || 0)) * bulk;
    if (kind === "transmute") return Math.max(50, Math.floor((detail.sellPrice || 0) / 5)) * bulk;
    return 0;
  }
  var bulkOf = (detail) => Math.max(1, Math.floor(detail.alchemyDetail?.bulkMultiplier || 1));
  var meanCount = (drop) => (Number(drop.dropRate ?? 1) || 0) * ((Number(drop.minCount ?? 1) + Number(drop.maxCount ?? 1)) / 2);
  function decomposeEssence(itemLevel, level) {
    return level > 0 ? Math.round(2 * (0.5 + 0.1 * Math.pow(1.05, itemLevel || 0)) * Math.pow(2, level)) : 0;
  }
  var decomposesEnhanced = (detail) => !!(detail?.equipmentDetail && detail.enhancementCosts?.length && detail.alchemyDetail?.decomposeItems?.length);
  function successOutputs(kind, detail, level = 0) {
    const a = detail.alchemyDetail;
    if (kind === "coinify") return [{ itemHrid: COIN, count: 5 * (detail.sellPrice || 0) }];
    if (kind === "decompose") {
      const out = (a.decomposeItems || []).map((d) => ({ itemHrid: d.itemHrid, count: d.count }));
      const essence = decomposeEssence(detail.itemLevel, level);
      if (essence >= 1) out.push({ itemHrid: ENHANCING_ESSENCE, count: essence });
      return out;
    }
    return (a.transmuteDropTable || []).map((d) => ({ itemHrid: d.itemHrid, count: meanCount(d) }));
  }
  function crateDrop(itemLevel) {
    if (itemLevel < 35) return { itemHrid: "/items/small_artisans_crate", rate: (100 + itemLevel) / 144e3 };
    if (itemLevel < 70) return { itemHrid: "/items/medium_artisans_crate", rate: (65 + itemLevel) / 216e3 };
    return { itemHrid: "/items/large_artisans_crate", rate: (30 + itemLevel) / 288e3 };
  }
  function alchemyAction(kind, detail, level = 0) {
    const k = ALCHEMY_KINDS[kind];
    const outputs = successOutputs(kind, detail, level).filter((o2) => o2.itemHrid !== detail.hrid);
    const main = kind === "coinify" ? COIN : level > 0 ? ENHANCING_ESSENCE : outputs.sort((x, y) => y.count - x.count)[0]?.itemHrid;
    return {
      hrid: alchemyHrid(kind, detail.hrid, level),
      name: `${k.name} ${detail.name}${level > 0 ? ` +${level}` : ""}`,
      kind,
      itemHrid: detail.hrid,
      enhancementLevel: level,
      type: TYPE,
      function: ALCHEMY_FUNCTION,
      levelRequirement: { skillHrid: SKILL, level: detail.itemLevel || 1 },
      baseTimeCost: BASE_SECONDS * 1e9,
      outputItems: main ? [{ itemHrid: main, count: 1 }] : [],
      sortIndex: detail.sortIndex || 0
    };
  }
  var alchemyHrid = (kind, itemHrid, level = 0) => `${ALCHEMY_KINDS[kind].hrid}#${itemHrid}${level > 0 ? `#+${level}` : ""}`;
  function alchemyActions(data, market, plusLevels = () => []) {
    const list = [];
    for (const detail of Object.values(data.itemDetailMap)) {
      const a = detail.alchemyDetail;
      if (a && detail.isTradable && decomposesEnhanced(detail)) {
        for (const level of plusLevels(detail.hrid)) if (level > 0) list.push(alchemyAction("decompose", detail, level));
      }
      if (!a || !detail.isTradable || market.buy(detail.hrid) === null) continue;
      const kinds = [];
      if (a.isCoinifiable && detail.sellPrice > 0) kinds.push("coinify");
      if (a.decomposeItems?.length) kinds.push("decompose");
      if (a.transmuteDropTable?.length && a.transmuteSuccessRate > 0) kinds.push("transmute");
      for (const kind of kinds) list.push(alchemyAction(kind, detail));
    }
    return list.sort((a, b) => a.levelRequirement.level - b.levelRequirement.level || a.sortIndex - b.sortIndex || (a.enhancementLevel || 0) - (b.enhancementLevel || 0));
  }
  var decomposeAction = (detail, level) => alchemyAction("decompose", detail, level);
  function evaluateAlchemy(action, who, data, market, teas, { score: score2 = (r) => r.goldPerDay, plusBuy = () => null, plusHeld = () => 0, itemPrice = null } = {}) {
    const detail = data.itemDetailMap[action.itemHrid];
    const kind = action.kind;
    const k = ALCHEMY_KINDS[kind];
    const buff = totals([...who.buffs?.[TYPE] || [], ...teaBuffs(teas, who.concentration, data)]);
    const fraction = (type) => buff(type).flat + buff(type).ratio;
    const level = who.levels[SKILL] ?? 1;
    const levelBuff = buff("/buff_types/alchemy_level");
    const effectiveLevel = (1 + levelBuff.ratio) * level + levelBuff.flat;
    const itemLevel = detail.itemLevel || 1;
    const bulk = bulkOf(detail);
    const levelEfficiency = Math.max(0, effectiveLevel - itemLevel) / 100;
    const efficiency = fraction("/buff_types/efficiency") + levelEfficiency;
    const speed = fraction("/buff_types/action_speed");
    const cycleSeconds = Math.max(MIN_CYCLE_SECONDS, BASE_SECONDS / (1 + speed));
    const actionsPerHour = 3600 / cycleSeconds * (1 + efficiency);
    const baseRate = kind === "transmute" ? detail.alchemyDetail.transmuteSuccessRate : k.rate;
    const penalty = levelPenalty(effectiveLevel, itemLevel);
    const successBuff = fraction("/buff_types/alchemy_success");
    const wisdom = fraction("/buff_types/wisdom");
    const xpBase = k.xp * (10 + itemLevel) * (1 + wisdom);
    const plus = action.enhancementLevel || 0;
    const plusAsk = plus > 0 ? plusBuy(action.itemHrid, plus) : null;
    const forSale = plus === 0 || plusAsk !== null;
    const price = itemPrice !== null ? itemPrice : plus > 0 ? plusAsk ?? plusHeld(action.itemHrid, plus) : market.buy(action.itemHrid);
    const coins10 = coinCost(kind, detail);
    const drinksPerHour = 12 * who.concentration;
    const teaCosts = teas.map((hrid) => {
      const p2 = market.buy(hrid) ?? market.sell(hrid).bid ?? 0;
      return { itemHrid: hrid, price: p2, perHour: p2 * drinksPerHour };
    });
    const teaPerHour = teaCosts.reduce((sum, t4) => sum + t4.perHour, 0);
    const essence = { itemHrid: ESSENCE, count: (100 + itemLevel) / 1800 * (1 + fraction("/buff_types/essence_find")) };
    const crate = crateDrop(itemLevel);
    const rare = { itemHrid: crate.itemHrid, count: crate.rate * (1 + fraction("/buff_types/rare_find")) };
    const catalysts = [{ itemHrid: null, bonus: 0 }];
    for (const [hrid, bonus] of [[k.catalyst, CATALYST_BONUS.kind], [PRIME, CATALYST_BONUS.prime]]) {
      if (market.buy(hrid) !== null) catalysts.push({ itemHrid: hrid, bonus, price: market.buy(hrid) });
    }
    let best = null;
    for (const catalyst of catalysts) {
      const successRate = Math.min(1, Math.max(0, baseRate * (1 + catalyst.bonus + successBuff + penalty)));
      const outputs = [];
      const add = (itemHrid, count3, kindOf) => {
        if (count3 <= 0) return;
        const sell = itemHrid === COIN ? { price: 1, source: "coin" } : market.sell(itemHrid);
        outputs.push({ itemHrid, count: count3, kind: kindOf, price: sell.price, sell, value: count3 * sell.price });
      };
      let selfBack = 0;
      for (const o2 of successOutputs(kind, detail, plus)) {
        if (o2.itemHrid === action.itemHrid) selfBack += o2.count * bulk * successRate;
        else add(o2.itemHrid, o2.count * bulk * successRate, "product");
      }
      add(essence.itemHrid, essence.count, "essence");
      add(rare.itemHrid, rare.count, "rare");
      const inputs = [{ itemHrid: action.itemHrid, enhancementLevel: plus, count: bulk - selfBack, price, value: (bulk - selfBack) * (price || 0), ...forSale ? {} : { forSale: false } }];
      if (coins10) inputs.push({ itemHrid: COIN, count: coins10, price: 1, value: coins10 });
      if (catalyst.itemHrid) inputs.push({ itemHrid: catalyst.itemHrid, count: successRate, price: catalyst.price, value: successRate * catalyst.price, catalyst: true });
      const revenuePerAction = outputs.reduce((sum, o2) => sum + o2.value, 0);
      const costPerAction = inputs.reduce((sum, i) => sum + i.value, 0);
      const profitPerHour = actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour;
      const xpPerAction = xpBase * (successRate + FAIL_XP * (1 - successRate));
      const main = plus > 0 && outputs.find((o2) => o2.itemHrid === ENHANCING_ESSENCE) || outputs.filter((o2) => o2.kind === "product").sort((a, b) => b.value - a.value)[0] || null;
      const warnings = [];
      if (main && main.sell.note) warnings.push({ kind: main.sell.note, itemHrid: main.itemHrid, ask: main.sell.ask, bid: main.sell.bid });
      const r = {
        action,
        hrid: action.hrid,
        skill: SKILL,
        teas,
        level,
        effectiveLevel,
        requiredLevel: itemLevel,
        efficiency,
        levelEfficiency,
        speed,
        baseSeconds: BASE_SECONDS,
        cycleSeconds,
        actionsPerHour,
        quantity: 0,
        artisan: 0,
        processing: 0,
        outputs,
        inputs,
        teaCosts,
        drinksPerHour,
        revenuePerAction,
        costPerAction,
        teaPerHour,
        profitPerHour,
        margin: revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null,
        mainCount: main ? main.count : bulk,
        xpPerAction,
        xpPerHour: actionsPerHour * xpPerAction,
        valid: price !== null && price !== void 0 && successRate > 0 && (!!main || kind === "coinify"),
        enhancementLevel: plus,
        warnings,
        buffsKnown: !!who.buffs,
        bulk,
        coinCost: coins10,
        baseRate,
        successRate,
        penalty,
        successBuff,
        catalyst,
        wisdom,
        goldPerDay: profitPerHour * 24,
        xpPerDay: actionsPerHour * xpPerAction * 24
      };
      r.coinsPerXp = r.xpPerHour > 0 ? -r.profitPerHour / r.xpPerHour : null;
      if (!best || score2(r) > score2(best) + 1e-12) best = r;
    }
    return best;
  }

  // src/enhancing.js
  var ENHANCING = "enhancing";
  var TYPE2 = "/action_types/enhancing";
  var SKILL2 = "/skills/enhancing";
  var ENHANCE_FUNCTION = "/action_functions/enhancing";
  var BASE_SECONDS2 = 12;
  var MAX_TARGET = 20;
  var BASE_RATES = [0.5, 0.45, 0.45, 0.4, 0.4, 0.4, 0.35, 0.35, 0.35, 0.35, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
  var FAIL_XP2 = 0.1;
  var OBSERVATORY = "/house_rooms/observatory";
  var OBSERVATORY_SUCCESS = 5e-4;
  var SUCCESS = "/buff_types/enhancing_success";
  var ESSENCE2 = "/items/enhancing_essence";
  var MIRROR = "/items/mirror_of_protection";
  var MIN_PROTECT = 2;
  function enhanceCrate(itemLevel) {
    if (itemLevel < 35) return { itemHrid: "/items/small_artisans_crate", rate: (100 + itemLevel) / 12e4 };
    if (itemLevel < 70) return { itemHrid: "/items/medium_artisans_crate", rate: (65 + itemLevel) / 18e4 };
    return { itemHrid: "/items/large_artisans_crate", rate: (30 + itemLevel) / 24e4 };
  }
  function levelBonus(level, itemLevel) {
    if (level >= itemLevel) return OBSERVATORY_SUCCESS * (level - itemLevel);
    return -0.5 * (1 - level / itemLevel);
  }
  function enhanceCycles(p2, blessed, xpAt) {
    const reach = [1];
    for (let L2 = 1; L2 <= MAX_TARGET; L2++) reach[L2] = reach[L2 - 1] * p2[L2 - 1] * (1 - blessed) + (L2 >= 2 ? reach[L2 - 2] * p2[L2 - 2] * blessed : 0);
    const attempts = [0];
    const xp = [0];
    let visits = 0;
    let gained = 0;
    for (let T = 1; T <= MAX_TARGET; T++) {
      const L2 = T - 1;
      visits += reach[L2];
      gained += reach[L2] * (p2[L2] + FAIL_XP2 * (1 - p2[L2])) * xpAt[L2];
      const done2 = reach[L2] * p2[L2] + (L2 >= 1 ? reach[L2 - 1] * p2[L2 - 1] * blessed : 0);
      attempts[T] = done2 > 0 ? visits / done2 : Infinity;
      xp[T] = done2 > 0 ? gained / done2 : Infinity;
    }
    return { attempts, xp, reach };
  }
  var SOLVE = { a: new Float64Array(3 * (MAX_TARGET + 2)), b: new Float64Array(MAX_TARGET + 2), d: new Float64Array(MAX_TARGET + 2) };
  function protectedCycle(p2, blessed, target, from, xpPer, start2 = 0) {
    const { a, b, d } = SOLVE;
    a.fill(0, 3 * target, 3 * (target + 2));
    b[target] = b[target + 1] = d[target] = d[target + 1] = 0;
    for (let L2 = target - 1; L2 >= 0; L2--) {
      const up1 = p2[L2] * (1 - blessed);
      const up2 = p2[L2] * blessed;
      const fail = 1 - p2[L2];
      const guarded = L2 >= from;
      const b1 = b[L2 + 1];
      const b2 = b[L2 + 2];
      const keep2 = 1 - up1 * b1 - up2 * b2 * b1;
      if (keep2 <= 1e-15) return null;
      const cost = [1, xpPer[L2], guarded ? fail : 0];
      for (let i = 0; i < 3; i++) {
        const a1 = a[3 * (L2 + 1) + i];
        a[3 * L2 + i] = (cost[i] + up1 * a1 + up2 * (a[3 * (L2 + 2) + i] + b2 * a1)) / keep2;
      }
      b[L2] = guarded ? fail / keep2 : 0;
      d[L2] = (up1 * d[L2 + 1] + up2 * (b2 * d[L2 + 1] + d[L2 + 2]) + (guarded ? 0 : fail)) / keep2;
    }
    const rest = 1 - d[0];
    if (rest <= 1e-15) return null;
    const e0 = [a[0] / rest, a[1] / rest, a[2] / rest];
    let e2 = e0;
    for (let L2 = 1; L2 <= start2 && L2 < target; L2++) e2 = e2.map((prev, i) => a[3 * L2 + i] + b[L2] * prev + d[L2] * e0[i]);
    return { attempts: e2[0], xp: e2[1], protections: e2[2] };
  }
  function protectedCycles(p2, blessed, target, from) {
    if (!protectedCycle(p2, blessed, target, from, NO_XP)) return null;
    const { a, b, d } = SOLVE;
    const rest = 1 - d[0];
    const attempts = [a[0] / rest];
    const protections = [a[2] / rest];
    for (let L2 = 1; L2 < target; L2++) {
      attempts[L2] = a[3 * L2] + b[L2] * attempts[L2 - 1] + d[L2] * attempts[0];
      protections[L2] = a[3 * L2 + 2] + b[L2] * protections[L2 - 1] + d[L2] * protections[0];
    }
    return { attempts, protections };
  }
  var NO_XP = new Array(MAX_TARGET + 2).fill(0);
  function cheapestProtection(detail, market) {
    let best = null;
    for (const itemHrid of /* @__PURE__ */ new Set([detail.hrid, MIRROR, ...detail.protectionItemHrids || []])) {
      const price = market.buy(itemHrid);
      if (price !== null && (!best || price < best.price)) best = { itemHrid, price };
    }
    return best;
  }
  function materials(detail, market) {
    const inputs = [];
    for (const cost of detail.enhancementCosts || []) {
      const price = market.buy(cost.itemHrid);
      if (price === null) return null;
      inputs.push({ itemHrid: cost.itemHrid, count: cost.count, price, value: cost.count * price });
    }
    return inputs.length ? inputs : null;
  }
  function enhancingActions(data, market, owned = () => 0) {
    const list = [];
    for (const detail of Object.values(data.itemDetailMap)) {
      if (!detail.equipmentDetail || !detail.enhancementCosts?.length || !detail.isTradable) continue;
      if (market.buy(detail.hrid) === null && !(owned(detail.hrid) > 0)) continue;
      if (!materials(detail, market)) continue;
      list.push({
        hrid: `/actions/enhancing/enhance#${detail.hrid}`,
        name: detail.name,
        itemHrid: detail.hrid,
        type: TYPE2,
        function: ENHANCE_FUNCTION,
        levelRequirement: { skillHrid: SKILL2, level: detail.itemLevel || 1 },
        baseTimeCost: BASE_SECONDS2 * 1e9,
        sortIndex: detail.sortIndex || 0
      });
    }
    return list.sort((a, b) => a.levelRequirement.level - b.levelRequirement.level || a.sortIndex - b.sortIndex);
  }
  function missingSuccess(who, data) {
    const sent = (key2) => (who.sources?.[key2]?.[TYPE2] || []).some((b) => b.typeHrid === SUCCESS);
    let bonus = 0;
    if (!sent("equipmentActionTypeBuffsMap")) {
      const multipliers = data.enhancementLevelTotalBonusMultiplierTable || [];
      for (const item of who.equipped || []) {
        const detail = data.itemDetailMap[item.itemHrid]?.equipmentDetail;
        const base = detail?.noncombatStats?.enhancingSuccess || 0;
        const extra = detail?.noncombatEnhancementBonuses?.enhancingSuccess || 0;
        bonus += base + extra * (multipliers[item.enhancementLevel || 0] || 0);
      }
    }
    if (!sent("houseActionTypeBuffsMap")) bonus += OBSERVATORY_SUCCESS * (who.houseLevels?.[OBSERVATORY] || 0);
    return bonus;
  }
  function baseItem(action, market, owned) {
    const have6 = owned(action.itemHrid) > 0;
    if (have6) {
      const bid = market.sell(action.itemHrid).bid;
      return { price: bid ? bid * (1 - MARKET_TAX) : 0, owned: true };
    }
    const price = market.buy(action.itemHrid);
    return price === null ? null : { price, owned: false };
  }
  function enhanceRates(who, data, teas, itemLevel) {
    const buff = totals([...who.buffs?.[TYPE2] || [], ...teaBuffs(teas, who.concentration, data)]);
    const fraction = (type) => buff(type).flat + buff(type).ratio;
    const level = who.levels[SKILL2] ?? 1;
    const levelBuff = buff("/buff_types/enhancing_level");
    const effectiveLevel = (1 + levelBuff.ratio) * level + levelBuff.flat;
    const success = fraction(SUCCESS) + missingSuccess(who, data);
    const bonus = levelBonus(effectiveLevel, itemLevel);
    const multiplier = Math.max(0, 1 + bonus + success);
    const rates = BASE_RATES.map((r) => Math.min(1, r * multiplier));
    const blessed = Math.max(0, fraction("/buff_types/blessed"));
    const levelSpeed = Math.max(0, effectiveLevel - itemLevel) / 100;
    const speed = fraction("/buff_types/action_speed") + levelSpeed;
    return { fraction, level, effectiveLevel, success, bonus, multiplier, rates, blessed, levelSpeed, speed, cycleSeconds: BASE_SECONDS2 / (1 + speed) };
  }
  function evaluateEnhance(action, who, data, market, teas, { resale, owned = () => 0, score: score2 = (r) => r.goldPerDay, target: fixedTarget = null, finish = () => null } = {}) {
    const itemLevel = action.levelRequirement.level;
    const detail = data.itemDetailMap[action.itemHrid];
    const { fraction, level, effectiveLevel, success, bonus, multiplier, rates, blessed, levelSpeed, speed, cycleSeconds } = enhanceRates(who, data, teas, itemLevel);
    const actionsPerHour = 3600 / cycleSeconds;
    const wisdom = fraction("/buff_types/wisdom");
    const xpAt = rates.map((_, L2) => 1.4 * (1 + L2) * (10 + itemLevel) * (1 + wisdom));
    const cycles = enhanceCycles(rates, blessed, xpAt);
    const inputs = materials(detail, market) || [];
    const costPerAttempt = inputs.reduce((sum, i) => sum + i.value, 0);
    const drops = [];
    const crate = enhanceCrate(itemLevel);
    for (const [itemHrid, count3, kind] of [[ESSENCE2, (100 + itemLevel) / 1e3 * (1 + fraction("/buff_types/essence_find")), "essence"], [crate.itemHrid, crate.rate * (1 + fraction("/buff_types/rare_find")), "rare"]]) {
      const sell = market.sell(itemHrid);
      drops.push({ itemHrid, count: count3, kind, price: sell.price, sell, value: count3 * sell.price });
    }
    const dropsPerAttempt = drops.reduce((sum, d) => sum + d.value, 0);
    const base = baseItem(action, market, owned);
    const drinksPerHour = 12 * who.concentration;
    const teaCosts = teas.map((hrid) => {
      const price = market.buy(hrid) ?? market.sell(hrid).bid ?? 0;
      return { itemHrid: hrid, price, perHour: price * drinksPerHour };
    });
    const teaPerHour = teaCosts.reduce((sum, t4) => sum + t4.perHour, 0);
    const common = {
      action,
      hrid: action.hrid,
      skill: SKILL2,
      teas,
      level,
      effectiveLevel,
      requiredLevel: itemLevel,
      efficiency: 0,
      levelEfficiency: 0,
      speed,
      levelSpeed,
      baseSeconds: BASE_SECONDS2,
      cycleSeconds,
      actionsPerHour,
      quantity: 0,
      artisan: 0,
      processing: 0,
      teaCosts,
      drinksPerHour,
      teaPerHour,
      rates,
      multiplier,
      levelBonus: bonus,
      successBonus: success,
      blessed,
      wisdom,
      base,
      warnings: [],
      buffsKnown: !!who.buffs
    };
    const guard = cheapestProtection(detail, market);
    const valid = !!base && inputs.length > 0;
    const build = (target, sold, cycle, protect, full = false, fin = null) => {
      const { attempts } = cycle;
      const perCycle = 1 / attempts;
      const share = fin ? attempts / actionsPerHour / (attempts / actionsPerHour + fin.hours) : 1;
      const madePerDay = actionsPerHour / attempts * 24 * share;
      const { price, salesCap } = fin ? { price: fin.value, salesCap: null } : salesLimited({ ...sold, floor: sold.floor === void 0 ? void 0 : Math.min(sold.floor, sold.price) }, madePerDay);
      const guardValue = protect ? cycle.protections / attempts * protect.price : 0;
      const attemptCost = costPerAttempt + guardValue;
      const revenuePerAction = perCycle * price + dropsPerAttempt;
      const itemCost = base ? fin ? Math.max(base.price, fin.itemFloor || 0) : base.price : 0;
      const costPerAction = attemptCost + perCycle * itemCost;
      const profitPerHour = share * (actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour);
      const xpPerAction = cycle.xp / attempts;
      const xpPerHour = share * actionsPerHour * xpPerAction;
      const numbers = { skill: SKILL2, target, valid, goldPerDay: profitPerHour * 24, xpPerDay: xpPerHour * 24, coinsPerXp: xpPerHour > 0 ? -profitPerHour / xpPerHour : null, attempts, protect, cycle, fin };
      if (!full) return numbers;
      const itemIn = base ? { itemHrid: action.itemHrid, count: perCycle, price: itemCost, value: perCycle * itemCost, upgrade: true, owned: base.owned } : null;
      const guardIn = protect ? { itemHrid: protect.itemHrid, count: cycle.protections / attempts, price: protect.price, value: guardValue, protection: true } : null;
      const perAttempt = guardIn ? [...inputs, guardIn] : inputs;
      const sell = fin ? { price: fin.value, source: "decompose", history: true, level: target } : sold;
      const outputs = [{ itemHrid: action.itemHrid, enhancementLevel: target, count: perCycle, kind: "product", price, sell, value: perCycle * price }, ...drops];
      return {
        ...common,
        ...numbers,
        attempts,
        protect: protect ? { ...protect, protections: cycle.protections } : null,
        itemsPerHour: actionsPerHour / attempts * share,
        // The share of the hours spent enhancing; the rest decomposes the +target (finish).
        enhanceShare: share,
        finish: fin,
        sold,
        salesCap,
        outputs,
        inputs: itemIn ? [...perAttempt, itemIn] : perAttempt,
        costPerAttempt: attemptCost,
        dropsPerAttempt,
        revenuePerAction,
        costPerAction,
        profitPerHour,
        margin: revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null,
        mainCount: perCycle,
        xpPerAction,
        xpPerHour
      };
    };
    const results = [];
    const xpPer = rates.map((r, L2) => (r + FAIL_XP2 * (1 - r)) * xpAt[L2]);
    const atZero = finish(action.itemHrid, 0);
    for (let target = 1; target <= MAX_TARGET; target++) {
      const attempts = cycles.attempts[target];
      if (!Number.isFinite(attempts) || attempts <= 0) break;
      const sold = resale ? resale(action.itemHrid, target) : { price: 0, source: "none", level: null };
      const decomposed = finish(action.itemHrid, target);
      const fin = decomposed && decomposed.value > sold.price ? { ...decomposed, itemFloor: Math.max(0, atZero?.value || 0) } : null;
      const ways = [{ cycle: { attempts, xp: cycles.xp[target], protections: 0 }, protect: null }];
      for (let from = MIN_PROTECT; guard && from < target; from++) {
        const cycle = protectedCycle(rates, blessed, target, from, xpPer);
        if (cycle) ways.push({ cycle, protect: { ...guard, from } });
      }
      let best2 = null;
      for (const f of fin ? [null, fin] : [null]) {
        for (const way of ways) {
          const r = build(target, sold, way.cycle, way.protect, false, f);
          if (!best2 || score2(r) > score2(best2) + 1e-12) best2 = r;
        }
      }
      results.push(build(target, sold, best2.cycle, best2.protect, true, best2.fin));
    }
    let best = results[0];
    for (const r of results) if (score2(r) > score2(best) + 1e-12) best = r;
    if (fixedTarget) best = results.find((r) => r.target === Math.min(MAX_TARGET, fixedTarget)) || best;
    best.targets = results.map((r) => ({ target: r.target, attempts: r.attempts, protect: r.protect, goldPerDay: r.goldPerDay, xpPerDay: r.xpPerDay, coinsPerXp: r.coinsPerXp, sell: r.outputs[0].sell, finish: r.finish }));
    return best;
  }
  function selfEnhanceCosts(itemHrid, who, data, market, starts) {
    const detail = data.itemDetailMap[itemHrid];
    const inputs = detail?.enhancementCosts?.length ? materials(detail, market) : null;
    if (!inputs) return () => null;
    const costPerAttempt = inputs.reduce((sum, i) => sum + i.value, 0);
    const guard = cheapestProtection(detail, market);
    const firsts = [...new Set(starts)].filter((s2) => s2 >= 0 && s2 < MAX_TARGET);
    const best = /* @__PURE__ */ new Map();
    for (const teas of costTeaSetups(who, data, market)) {
      const { rates, blessed, cycleSeconds } = enhanceRates(who, data, teas, detail.itemLevel || 1);
      const teaPerHour = teas.reduce((sum, hrid) => sum + (market.buy(hrid) ?? 0), 0) * 12 * (who.concentration || 1);
      const perAttempt = costPerAttempt + teaPerHour * cycleSeconds / 3600;
      for (let target = 1; target <= MAX_TARGET; target++) {
        const froms = [target];
        if (guard) for (let from = MIN_PROTECT; from < target; from++) froms.push(from);
        for (const from of froms) {
          const cycles = protectedCycles(rates, blessed, target, from);
          if (!cycles) continue;
          const guarded = from < target;
          for (const start2 of firsts) {
            if (start2 >= target) continue;
            const attempts = cycles.attempts[start2];
            if (!Number.isFinite(attempts)) continue;
            const protections = guarded ? cycles.protections[start2] : 0;
            const cost = attempts * perAttempt + (guarded ? protections * guard.price : 0);
            const key2 = start2 * 100 + target;
            const known = best.get(key2);
            if (known && known.cost <= cost) continue;
            const hours = attempts * cycleSeconds / 3600;
            best.set(key2, { cost, attempts, protections, protect: guarded ? { ...guard, from } : null, teas, hours, drinks: hours * 12 * (who.concentration || 1), materials: inputs });
          }
        }
      }
    }
    return (start2, target) => best.get(start2 * 100 + target) || null;
  }
  var COST_BUFFS = /* @__PURE__ */ new Set([SUCCESS, "/buff_types/blessed", "/buff_types/enhancing_level", "/buff_types/action_speed"]);
  function costTeaSetups(who, data, market) {
    const drinks = who.drinks?.[TYPE2] || [];
    const candidates = usableTeas(data, TYPE2).filter(
      (hrid) => (market.buy(hrid) !== null || drinks.includes(hrid)) && (data.itemDetailMap[hrid]?.consumableDetail?.buffs || []).some((b) => COST_BUFFS.has(b.typeHrid))
    );
    return teaSetups(data, TYPE2, who.slots?.[TYPE2] ?? 1, candidates);
  }

  // src/alchemy-chain.js
  var COIN2 = "/items/coin";
  var MAX_DEPTH = 6;
  var MAX_ITEMS = 150;
  var SWEEPS = 60;
  var ROUNDS = 8;
  function stepsFor(itemHrid, who, data, market, teas, cache) {
    if (cache.has(itemHrid)) return cache.get(itemHrid);
    const steps = [];
    const detail = data.itemDetailMap[itemHrid];
    const a = detail?.alchemyDetail;
    if (a) {
      const kinds = [];
      if (a.isCoinifiable && detail.sellPrice > 0) kinds.push("coinify");
      if (a.decomposeItems?.length) kinds.push("decompose");
      if (a.transmuteDropTable?.length && a.transmuteSuccessRate > 0) kinds.push("transmute");
      for (const kind of kinds) {
        const action = { hrid: alchemyHrid(kind, itemHrid), kind, itemHrid, enhancementLevel: 0, levelRequirement: { level: detail.itemLevel || 1 } };
        const r = evaluateAlchemy(action, who, data, market, teas, { itemPrice: 0 });
        const net = r.inputs[0]?.count || 0;
        if (!r.successRate || !(net > 1e-9) || !(r.actionsPerHour > 0)) continue;
        const paid = r.inputs.slice(1).reduce((sum, i) => sum + i.value, 0);
        steps.push({
          kind,
          itemHrid,
          net,
          outputs: r.outputs.map((o2) => ({ itemHrid: o2.itemHrid, count: o2.count })),
          paid,
          hours: 1 / r.actionsPerHour,
          xp: r.xpPerAction,
          catalyst: r.catalyst?.itemHrid || null,
          successRate: r.successRate
        });
      }
    }
    cache.set(itemHrid, steps);
    return steps;
  }
  function reachable(entry, steps) {
    const seen = /* @__PURE__ */ new Set();
    let frontier = entry.outputs.map((o2) => o2.itemHrid).filter((h3) => h3 !== COIN2);
    for (let depth = 0; depth < MAX_DEPTH && frontier.length && seen.size < MAX_ITEMS; depth++) {
      const next = [];
      for (const hrid of frontier) {
        if (seen.has(hrid) || seen.size >= MAX_ITEMS) continue;
        seen.add(hrid);
        for (const step of steps(hrid)) for (const o2 of step.outputs) if (o2.itemHrid !== COIN2 && !seen.has(o2.itemHrid)) next.push(o2.itemHrid);
      }
      frontier = next;
    }
    return [...seen];
  }
  function choose(items, sell, steps, charge, teaPerHour) {
    const worth = new Map(items.map((h3) => [h3, sell(h3)]));
    const value = (h3) => h3 === COIN2 ? 1 : worth.has(h3) ? worth.get(h3) : sell(h3);
    const choice = /* @__PURE__ */ new Map();
    for (let sweep = 0; sweep < SWEEPS; sweep++) {
      let moved = 0;
      for (const h3 of items) {
        let best = sell(h3);
        let pick2 = null;
        for (const step of steps(h3)) {
          const v = (step.outputs.reduce((sum, o2) => sum + o2.count * value(o2.itemHrid), 0) - step.paid - (teaPerHour + charge) * step.hours) / step.net;
          if (v > best + 1e-9) {
            best = v;
            pick2 = step;
          }
        }
        moved = Math.max(moved, Math.abs(best - worth.get(h3)) / Math.max(1, Math.abs(best)));
        worth.set(h3, best);
        choice.set(h3, pick2);
      }
      if (moved < 1e-9) break;
    }
    for (const v of worth.values()) if (!Number.isFinite(v) || v > 1e15) return null;
    return choice;
  }
  function follow(items, sell, choice) {
    const gold = /* @__PURE__ */ new Map();
    const hours = /* @__PURE__ */ new Map();
    const xp = /* @__PURE__ */ new Map();
    const val = (map, h3, sold) => h3 === COIN2 ? map === gold ? 1 : 0 : map.has(h3) ? map.get(h3) : sold(h3);
    for (const h3 of items) {
      gold.set(h3, sell(h3));
      hours.set(h3, 0);
      xp.set(h3, 0);
    }
    const none = () => 0;
    for (let sweep = 0; sweep < SWEEPS; sweep++) {
      let moved = 0;
      for (const h3 of items) {
        const step = choice.get(h3);
        if (!step) continue;
        const g4 = (step.outputs.reduce((sum, o2) => sum + o2.count * val(gold, o2.itemHrid, sell), 0) - step.paid) / step.net;
        const t4 = (step.hours + step.outputs.reduce((sum, o2) => sum + o2.count * val(hours, o2.itemHrid, none), 0)) / step.net;
        const x = (step.xp + step.outputs.reduce((sum, o2) => sum + o2.count * val(xp, o2.itemHrid, none), 0)) / step.net;
        moved = Math.max(moved, Math.abs(g4 - gold.get(h3)) / Math.max(1, Math.abs(g4)), Math.abs(t4 - hours.get(h3)) / Math.max(1e-9, t4));
        gold.set(h3, g4);
        hours.set(h3, t4);
        xp.set(h3, x);
      }
      if (moved < 1e-9) break;
    }
    return { gold: (h3) => val(gold, h3, sell), hours: (h3) => val(hours, h3, none), xp: (h3) => val(xp, h3, none) };
  }
  function flows(entry, items, choice) {
    const amount2 = /* @__PURE__ */ new Map();
    for (const o2 of entry.outputs) if (o2.itemHrid !== COIN2) amount2.set(o2.itemHrid, (amount2.get(o2.itemHrid) || 0) + o2.count);
    const actions = /* @__PURE__ */ new Map();
    const sold = /* @__PURE__ */ new Map();
    for (let sweep = 0; sweep < SWEEPS * 4; sweep++) {
      let pushed = false;
      for (const h3 of [...amount2.keys()]) {
        const n5 = amount2.get(h3);
        if (n5 < 1e-12) continue;
        amount2.set(h3, 0);
        const step = choice.get(h3);
        if (!step) {
          sold.set(h3, (sold.get(h3) || 0) + n5);
          continue;
        }
        pushed = true;
        const times = n5 / step.net;
        actions.set(h3, { step, count: (actions.get(h3)?.count || 0) + times });
        for (const o2 of step.outputs) if (o2.itemHrid !== COIN2) amount2.set(o2.itemHrid, (amount2.get(o2.itemHrid) || 0) + o2.count * times);
      }
      if (!pushed) break;
    }
    return { actions: [...actions.values()], sold: [...sold].map(([itemHrid, count3]) => ({ itemHrid, count: count3 })) };
  }
  function alchemyChain(entry, who, data, market, caches = /* @__PURE__ */ new Map()) {
    if (!entry?.valid || !(entry.actionsPerHour > 0)) return null;
    const teaKey = entry.teas.join(",");
    if (!caches.has(teaKey)) caches.set(teaKey, /* @__PURE__ */ new Map());
    const cache = caches.get(teaKey);
    const steps = (h3) => stepsFor(h3, who, data, market, entry.teas, cache);
    const sellCache = /* @__PURE__ */ new Map();
    const sell = (h3) => {
      if (h3 === COIN2) return 1;
      if (!sellCache.has(h3)) sellCache.set(h3, entry.outputs.find((o2) => o2.itemHrid === h3)?.price ?? market.sell(h3).price ?? 0);
      return sellCache.get(h3);
    };
    const items = reachable(entry, steps);
    if (!items.some((h3) => steps(h3).length)) return null;
    const ownHours = 1 / entry.actionsPerHour;
    const ownCost = entry.costPerAction;
    let rate2 = Math.max(0, entry.profitPerHour);
    let result = null;
    let last = null;
    for (let round = 0; round < ROUNDS; round++) {
      const choice2 = choose(items, sell, steps, Math.max(0, rate2), entry.teaPerHour);
      if (!choice2) return null;
      const key2 = items.map((h3) => choice2.get(h3)?.kind || "").join("|");
      if (key2 === last) break;
      last = key2;
      const f2 = follow(items, sell, choice2);
      const revenue2 = entry.outputs.reduce((sum, o2) => sum + o2.count * f2.gold(o2.itemHrid), 0);
      const hours2 = ownHours + entry.outputs.reduce((sum, o2) => sum + o2.count * f2.hours(o2.itemHrid), 0);
      const xp2 = entry.xpPerAction + entry.outputs.reduce((sum, o2) => sum + o2.count * f2.xp(o2.itemHrid), 0);
      const profitPerHour2 = (revenue2 - ownCost) / hours2 - entry.teaPerHour;
      result = { choice: choice2, revenue: revenue2, hours: hours2, xp: xp2, profitPerHour: profitPerHour2, f: f2 };
      rate2 = profitPerHour2;
    }
    if (!result || ![...result.choice.values()].some(Boolean) || !(result.profitPerHour > entry.profitPerHour + 1e-9)) return null;
    const { revenue, hours, xp, profitPerHour, choice, f } = result;
    const flow = flows(entry, items, choice);
    const actionsPerHour = 1 / hours;
    const further = flow.actions.map(({ step, count: count3 }) => ({ itemHrid: step.itemHrid, kind: step.kind, name: `${ALCHEMY_KINDS[step.kind].name} ${data.itemDetailMap[step.itemHrid]?.name || step.itemHrid}`, count: count3, hours: count3 * step.hours, catalyst: step.catalyst, successRate: step.successRate })).sort((a, b) => b.hours - a.hours);
    const outputs = entry.outputs.map((o2) => choice.get(o2.itemHrid) ? { ...o2, chainValue: f.gold(o2.itemHrid), chainHours: f.hours(o2.itemHrid) } : o2);
    const goldPerDay = profitPerHour * 24;
    const xpPerHour = xp * actionsPerHour;
    return {
      ...entry,
      single: entry,
      outputs,
      actionsPerHour,
      ownActionsPerHour: entry.actionsPerHour,
      revenuePerAction: revenue,
      profitPerHour,
      goldPerDay,
      margin: revenue > 0 ? (revenue - ownCost - entry.teaPerHour * hours) / revenue : null,
      xpPerAction: xp,
      xpPerHour,
      xpPerDay: xpPerHour * 24,
      coinsPerXp: xpPerHour > 0 ? -profitPerHour / xpPerHour : null,
      alchemyChain: {
        share: ownHours / hours,
        further,
        sold: flow.sold.filter((s2) => s2.count > 1e-9).sort((a, b) => b.count * sell(b.itemHrid) - a.count * sell(a.itemHrid)),
        singleGoldPerDay: entry.goldPerDay
      }
    };
  }

  // src/skilling.js
  var SKILLING_SKILLS = ["milking", "foraging", "woodcutting", "cheesesmithing", "crafting", "tailoring", "cooking", "brewing"];
  var LEVELING_SKILLS = ["alchemy", "enhancing"];
  var BUFF_SOURCES = [
    "mooPassActionTypeBuffsMap",
    "communityActionTypeBuffsMap",
    "houseActionTypeBuffsMap",
    "guildActionTypeBuffsMap",
    "achievementActionTypeBuffsMap",
    "equipmentActionTypeBuffsMap",
    "personalActionTypeBuffsMap"
  ];
  var MARKET_TAX = 0.04;
  var COWBELL_BAG_TAX = 0.18;
  var RISKY_MARGIN = 0.05;
  var DRINKS_PER_HOUR = 12;
  var MIN_CYCLE_SECONDS2 = 3;
  var NEAR_LEVELS = 10;
  var HOURS_PER_DAY = 24;
  var WIDE_SPREAD = 1.5;
  var INVENTORY = "/item_locations/inventory";
  var COIN3 = "/items/coin";
  var POUCH = "/item_locations/pouch";
  var TOTAL_LEVEL = "/skills/total_level";
  var BUFF = {
    efficiency: "/buff_types/efficiency",
    speed: "/buff_types/action_speed",
    actionLevel: "/buff_types/action_level",
    gathering: "/buff_types/gathering",
    gourmet: "/buff_types/gourmet",
    artisan: "/buff_types/artisan",
    processing: "/buff_types/processing",
    wisdom: "/buff_types/wisdom",
    essence: "/buff_types/essence_find",
    rare: "/buff_types/rare_find"
  };
  var skillName = (skillHrid) => skillHrid.split("/").pop();
  var skillType = (skill) => "/action_types/" + skill;
  function skillingCharacter(character, items, data) {
    const levels = {};
    const experience = {};
    for (const skill of character.characterSkills || []) {
      levels[skill.skillHrid] = skill.level;
      experience[skill.skillHrid] = skill.experience ?? null;
    }
    levels[TOTAL_LEVEL] ?? (levels[TOTAL_LEVEL] = Object.values(levels).reduce((sum, level) => sum + (Number(level) || 0), 0));
    const known = BUFF_SOURCES.filter((key2) => character[key2]);
    let buffs = null;
    if (known.length) {
      buffs = {};
      for (const key2 of known) {
        for (const [type, list] of Object.entries(character[key2] || {})) {
          if (Array.isArray(list)) (buffs[type] || (buffs[type] = [])).push(...list);
        }
      }
    }
    const drinks = {};
    const slots = {};
    const pouch = [...items.values()].find((item) => item.itemLocationHrid === POUCH && item.itemHrid)?.itemHrid || null;
    const pouchSlots = drinkSlots(pouch, data);
    for (const skill of [...SKILLING_SKILLS, ...LEVELING_SKILLS]) {
      const list = character.actionTypeDrinkSlotsMap?.[skillType(skill)];
      drinks[skillType(skill)] = (list || []).map((slot) => slot?.itemHrid).filter(Boolean);
      slots[skillType(skill)] = Math.max(pouchSlots, drinks[skillType(skill)].length);
    }
    const sources = Object.fromEntries(known.map((key2) => [key2, character[key2]]));
    const equipped = [...items.values()].filter((item) => item.itemHrid && item.itemLocationHrid !== INVENTORY).map((item) => ({ itemHrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 }));
    const houseLevels = {};
    for (const [hrid, room] of Object.entries(character.characterHouseRoomMap || {})) houseLevels[hrid] = room?.level || 0;
    return { levels, experience, buffs, drinks, slots, pouch, concentration: drinkConcentration(character, items, data), sources, equipped, houseLevels };
  }
  function drinkSlots(pouchHrid, data) {
    return 1 + (data.itemDetailMap[pouchHrid]?.equipmentDetail?.combatStats?.drinkSlots || 0);
  }
  function drinkConcentration(character, items, data) {
    const given = Number(character.noncombatStats?.drinkConcentration);
    if (Number.isFinite(given)) return 1 + Math.max(0, given);
    const multipliers = data.enhancementLevelTotalBonusMultiplierTable || [];
    let total = 0;
    for (const item of items.values()) {
      if (!item.itemHrid || item.itemLocationHrid === INVENTORY) continue;
      const detail = data.itemDetailMap[item.itemHrid]?.equipmentDetail;
      const base = detail?.noncombatStats?.drinkConcentration || 0;
      const bonus = detail?.noncombatEnhancementBonuses?.drinkConcentration || 0;
      total += base + bonus * (multipliers[item.enhancementLevel || 0] || 0);
    }
    return 1 + total;
  }
  function skillingActions(data) {
    const types = new Set(SKILLING_SKILLS.map(skillType));
    return Object.values(data.actionDetailMap).filter((action) => types.has(action.type) && action.levelRequirement && /\/(gathering|production)$/.test(action.function)).sort((a, b) => a.levelRequirement.level - b.levelRequirement.level || a.sortIndex - b.sortIndex);
  }
  var processingCache = /* @__PURE__ */ new WeakMap();
  function processedProducts(data) {
    let map = processingCache.get(data);
    if (map) return map;
    map = /* @__PURE__ */ new Map();
    for (const action of Object.values(data.actionDetailMap)) {
      if (!/(fabric|lumber|cheese)$/.test(action.hrid)) continue;
      const input = action.inputItems?.[0];
      const output = action.outputItems?.[0];
      if (input?.count > 0 && output) map.set(input.itemHrid, { itemHrid: output.itemHrid, inputCount: input.count });
    }
    processingCache.set(data, map);
    return map;
  }
  var teasByData = /* @__PURE__ */ new WeakMap();
  function usableTeas(data, type) {
    let byType = teasByData.get(data);
    if (!byType) teasByData.set(data, byType = /* @__PURE__ */ new Map());
    if (!byType.has(type)) {
      byType.set(type, Object.values(data.itemDetailMap).filter((item) => item.consumableDetail?.usableInActionTypeMap?.[type] && item.consumableDetail.buffs?.length && !item.consumableDetail.usableInActionTypeMap["/action_types/combat"]).map((item) => item.hrid));
    }
    return byType.get(type).slice();
  }
  function totals(buffs) {
    const sum = /* @__PURE__ */ new Map();
    for (const buff of buffs) {
      const entry = sum.get(buff.typeHrid) || { flat: 0, ratio: 0 };
      entry.flat += Number(buff.flatBoost) || 0;
      entry.ratio += Number(buff.ratioBoost) || 0;
      sum.set(buff.typeHrid, entry);
    }
    return (type) => sum.get(type) || { flat: 0, ratio: 0 };
  }
  function teaBuffs(teas, concentration, data) {
    const list = [];
    for (const hrid of teas) {
      for (const buff of data.itemDetailMap[hrid]?.consumableDetail?.buffs || []) {
        list.push({ typeHrid: buff.typeHrid, flatBoost: (buff.flatBoost || 0) * concentration, ratioBoost: (buff.ratioBoost || 0) * concentration });
      }
    }
    return list;
  }
  function marketPricer(entryOf, data, sellAt = "ask", usualAsk = () => null, soldOf = () => null) {
    const cache = /* @__PURE__ */ new Map();
    const contents = (hrid) => (data.openableLootDropMap?.[hrid] || []).reduce((sum, drop) => sum + meanCount2(drop) * (drop.itemHrid === hrid ? 0 : this_.sell(drop.itemHrid).price), 0);
    const vendor = (hrid) => data.itemDetailMap[hrid]?.sellPrice || 0;
    const tradable = (hrid) => !!data.itemDetailMap[hrid]?.isTradable;
    const this_ = {
      buy(hrid) {
        if (hrid === "/items/coin") return 1;
        const entry = tradable(hrid) ? entryOf(hrid) : null;
        return entry?.a > 0 ? entry.a : null;
      },
      sell(hrid) {
        if (cache.has(hrid)) return cache.get(hrid);
        const entry = tradable(hrid) && entryOf(hrid) || {};
        const ask = entry.a > 0 ? entry.a : null;
        const bid = entry.b > 0 ? entry.b : null;
        const tax = hrid === "/items/bag_of_10_cowbells" ? COWBELL_BAG_TAX : MARKET_TAX;
        cache.set(hrid, { price: 0 });
        let result;
        if (hrid === "/items/coin") result = { price: 1, ask: 1, bid: 1, source: "coin" };
        else if (hrid === "/items/cowbell") result = { ...this_.sell("/items/bag_of_10_cowbells"), source: "bag" };
        else if (!ask && !bid && data.openableLootDropMap?.[hrid]) result = { price: contents(hrid), ask, bid, source: "contents" };
        else if (sellAt === "ask" && ask) {
          const usual = usualAsk(hrid);
          const ceiling = usual > 0 ? usual : bid ? WIDE_SPREAD * bid : Infinity;
          result = { price: Math.min(ask, ceiling) * (1 - tax), ask, bid, source: "ask", capped: ask > ceiling ? usual > 0 ? "usual" : "spread" : null, note: bid ? ask > WIDE_SPREAD * bid ? "spread" : null : "nobids" };
        } else if (bid) result = { price: bid * (1 - tax), ask, bid, source: "bid", note: sellAt === "ask" ? "noasks" : null };
        else if (ask) result = { price: ask * (1 - tax), ask, bid, source: "ask", note: "nobids" };
        else result = { price: vendor(hrid), ask, bid, source: "vendor", note: vendor(hrid) ? "vendor" : "unsellable" };
        if (result.source === "bag") result = { ...result, price: result.price / 10, sold: void 0, floor: void 0 };
        if (result.source === "ask" || result.source === "bid") {
          result.sold = soldOf(hrid);
          const floor = result.source === "ask" && bid ? bid * (1 - tax) : vendor(hrid);
          result.floor = Math.min(floor, result.price);
        }
        cache.set(hrid, result);
        return result;
      }
    };
    return this_;
  }
  function salesLimited(sell, made) {
    if (!Number.isFinite(sell.sold) || sell.sold < 0 || sell.floor === void 0 || !(made > sell.sold)) return { price: sell.price, salesCap: null };
    const share = sell.sold / made;
    return { price: share * sell.price + (1 - share) * sell.floor, salesCap: { perDay: sell.sold, made, floor: sell.floor } };
  }
  var meanCount2 = (drop) => (Number(drop.dropRate ?? 1) || 0) * ((Number(drop.minCount ?? 1) + Number(drop.maxCount ?? 1)) / 2);
  function evaluateAction(action, who, data, market, teas = who.drinks[action.type] || [], level = who.levels[action.levelRequirement.skillHrid] ?? 1) {
    const skill = action.levelRequirement.skillHrid;
    const buff = totals([...who.buffs?.[action.type] || [], ...teaBuffs(teas, who.concentration, data)]);
    const fraction = (type) => buff(type).flat + buff(type).ratio;
    const levelBuff = buff(`/buff_types/${skillName(skill)}_level`);
    const effectiveLevel = (1 + levelBuff.ratio) * level + levelBuff.flat;
    const requiredLevel = action.levelRequirement.level + buff(BUFF.actionLevel).flat;
    const levelEfficiency = Math.max(0, effectiveLevel - requiredLevel) / 100;
    const efficiency = buff(BUFF.efficiency).flat + levelEfficiency;
    const speed = fraction(BUFF.speed);
    const baseSeconds = action.baseTimeCost / 1e9;
    const cycleSeconds = Math.max(MIN_CYCLE_SECONDS2, baseSeconds / (1 + speed));
    const actionsPerHour = 3600 / cycleSeconds * (1 + efficiency);
    const quantity = Math.max(0, fraction(BUFF.gathering) + fraction(BUFF.gourmet));
    const processing = Math.min(1, Math.max(0, fraction(BUFF.processing)));
    const artisan = Math.min(1, Math.max(0, fraction(BUFF.artisan)));
    const products = processing > 0 ? processedProducts(data) : null;
    const outputs = [];
    const addOutput = (itemHrid, count3, kind) => {
      if (count3 <= 0) return;
      const sell = market.sell(itemHrid);
      const { price, salesCap } = salesLimited(sell, count3 * actionsPerHour * HOURS_PER_DAY);
      outputs.push({ itemHrid, count: count3, kind, price, sell, value: count3 * price, salesCap });
    };
    const base = action.outputItems?.length ? action.outputItems.map((o2) => ({ itemHrid: o2.itemHrid, count: o2.count })) : (action.dropTable || []).map((d) => ({ itemHrid: d.itemHrid, count: meanCount2(d) }));
    for (const output of base) {
      const count3 = output.count * (1 + quantity);
      const processed = products?.get(output.itemHrid);
      addOutput(output.itemHrid, processed ? count3 * (1 - processing) : count3, "product");
      if (processed) addOutput(processed.itemHrid, count3 * processing / processed.inputCount, "processed");
    }
    for (const drop of action.essenceDropTable || []) addOutput(drop.itemHrid, meanCount2(drop) * (1 + fraction(BUFF.essence)), "essence");
    for (const drop of action.rareDropTable || []) addOutput(drop.itemHrid, meanCount2(drop) * (1 + fraction(BUFF.rare)), "rare");
    const inputs = (action.inputItems || []).map((input) => ({ itemHrid: input.itemHrid, count: input.count * (1 - artisan) }));
    if (action.upgradeItemHrid) inputs.push({ itemHrid: action.upgradeItemHrid, count: 1, upgrade: true });
    const missing = [];
    for (const input of inputs) {
      input.price = market.buy(input.itemHrid);
      if (input.price === null) missing.push(input.itemHrid);
      input.value = input.count * (input.price || 0);
    }
    const drinksPerHour = DRINKS_PER_HOUR * who.concentration;
    const teaCosts = teas.map((hrid) => {
      const price = market.buy(hrid) ?? market.sell(hrid).bid ?? 0;
      return { itemHrid: hrid, price, perHour: price * drinksPerHour };
    });
    const revenuePerAction = outputs.reduce((sum, o2) => sum + o2.value, 0);
    const costPerAction = inputs.reduce((sum, i) => sum + i.value, 0);
    const teaPerHour = teaCosts.reduce((sum, t4) => sum + t4.perHour, 0);
    const profitPerHour = actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour;
    const margin = revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null;
    const xpPerAction = (action.experienceGain?.value || 0) * (1 + fraction(BUFF.wisdom));
    const main = outputs.filter((o2) => o2.kind === "product").sort((a, b) => b.value - a.value)[0] || null;
    const warnings = [];
    if (missing.length) warnings.push({ kind: "noinput", items: missing });
    if (main && main.sell.note) warnings.push({ kind: main.sell.note, itemHrid: main.itemHrid, ask: main.sell.ask, bid: main.sell.bid });
    if (costPerAction > 0 && profitPerHour > 0 && margin < RISKY_MARGIN) warnings.push({ kind: "margin", margin });
    return {
      action,
      hrid: action.hrid,
      skill,
      teas,
      level,
      requiredLevel,
      effectiveLevel,
      efficiency,
      levelEfficiency,
      speed,
      baseSeconds,
      cycleSeconds,
      actionsPerHour,
      quantity,
      artisan,
      processing,
      outputs,
      inputs,
      teaCosts,
      drinksPerHour,
      revenuePerAction,
      costPerAction,
      teaPerHour,
      profitPerHour,
      margin,
      mainCount: main?.count || 0,
      salesCap: main?.salesCap || null,
      xpPerAction,
      xpPerHour: actionsPerHour * xpPerAction,
      valid: missing.length === 0 && !!main && main.sell.note !== "unsellable",
      warnings,
      buffsKnown: !!who.buffs
    };
  }
  function teaSetups(data, type, slots, candidates) {
    const unique = (hrid) => data.itemDetailMap[hrid]?.consumableDetail?.buffs?.[0]?.uniqueHrid || hrid;
    const setups = [[]];
    const grow = (start2, chosen) => {
      if (chosen.length >= slots) return;
      for (let i = start2; i < candidates.length; i++) {
        if (chosen.some((hrid) => unique(hrid) === unique(candidates[i]))) continue;
        const next = [...chosen, candidates[i]];
        setups.push(next);
        grow(i + 1, next);
      }
    };
    grow(0, []);
    return setups;
  }
  var daily = (result) => ({ ...result, goldPerDay: result.profitPerHour * HOURS_PER_DAY, xpPerDay: result.xpPerHour * HOURS_PER_DAY });
  function bestTeas(action, who, data, market, evaluate, score2 = (r) => r.goldPerDay) {
    const type = action.type;
    const candidates = usableTeas(data, type).filter((hrid) => market.buy(hrid) !== null || (who.drinks[type] || []).includes(hrid));
    let best = null;
    for (const teas of teaSetups(data, type, who.slots[type], candidates)) {
      const result = evaluate(teas, score2);
      if (!best || score2(result) > score2(best) + 1e-12) best = result;
    }
    const worth = best.teas.map((hrid) => {
      const without = evaluate(best.teas.filter((t4) => t4 !== hrid), score2);
      return { itemHrid: hrid, gainPerDay: best.goldPerDay - without.goldPerDay, xpPerDay: best.xpPerDay - without.xpPerDay };
    });
    return { result: best, worth };
  }
  var XP_PER_DAY = (r) => r.xpPerDay;
  function focusScore(goldWeight, refs, xpOf = XP_PER_DAY) {
    return (r) => goldWeight * r.goldPerDay / refs.gold + (1 - goldWeight) * xpOf(r) / refs.xp;
  }
  function levelProgress(who, data, countLevels) {
    const table = data.levelExperienceTable;
    if (!countLevels || !Array.isArray(table)) return XP_PER_DAY;
    return (r) => {
      const level = who.levels[r.skill] ?? 1;
      return levelsPerDay(table, experienceOf(table, who.experience[r.skill], level), r.xpPerDay);
    };
  }
  var coinsPerXp = (r) => coinsPer(r, XP_PER_DAY);
  var coinsPer = (r, xpOf) => r.valid && xpOf(r) > 0 ? -r.goldPerDay / xpOf(r) : Infinity;
  function timeMoneyScore(goldWeight, refs, xpOf = XP_PER_DAY) {
    const costScale = Math.max(1e-9, Math.abs(Number.isFinite(refs.cost) ? refs.cost : 1));
    return (r) => {
      const xp = xpOf(r);
      return xp > 0 && r.valid !== false ? -(goldWeight * -r.goldPerDay / xp / costScale + (1 - goldWeight) * refs.xp / xp) : -Infinity;
    };
  }
  function teaPurchase(entry, { hours, have: have6 = () => 0 }) {
    const teas = entry.best.result.teas;
    if (!teas.length || !(hours > 0)) return null;
    const perTea = Math.ceil(hours * entry.best.result.drinksPerHour);
    const items = teas.map((hrid) => ({ hrid, quantity: perTea - have6(hrid), have: have6(hrid) })).filter((item) => item.quantity > 0);
    return { hours, perTea, items };
  }
  function heldStock(character, items, itemHrid) {
    let inventory = 0;
    for (const item of items.values()) {
      if (item.itemHrid === itemHrid && item.itemLocationHrid === INVENTORY && !item.enhancementLevel) inventory += item.count || 0;
    }
    let listed = 0;
    const listings = [];
    for (const listing of character.myMarketListings || []) {
      if (listing.itemHrid !== itemHrid || !listing.isSell || listing.enhancementLevel) continue;
      const quantity = Math.max(0, (listing.orderQuantity || 0) - (listing.filledQuantity || 0));
      listed += quantity;
      listings.push({ price: Number(listing.price) || 0, quantity });
    }
    return { inventory, listed, listings };
  }
  var ASK_WINDOW = 0.05;
  function othersNearLowestAsk(book, stock) {
    if (!book?.asks.length) return { quantity: 0, lowest: null };
    const lowest = Math.min(...book.asks.map((o2) => o2.price));
    const top = lowest * (1 + ASK_WINDOW);
    const near = book.asks.filter((o2) => o2.price <= top).reduce((sum, o2) => sum + o2.quantity, 0);
    const mine2 = (stock.listings || []).filter((l2) => l2.price > 0 && l2.price <= top).reduce((sum, l2) => sum + l2.quantity, 0);
    return { quantity: Math.max(0, near - mine2), lowest };
  }
  function breakEvenPrice(entry) {
    const main = entry.outputs.filter((o2) => o2.kind === "product").sort((a, b) => b.value - a.value)[0];
    if (!main) return null;
    const others = entry.revenuePerAction - main.value;
    return (entry.costPerAction + entry.teaPerHour / entry.actionsPerHour - others) / main.count / (1 - MARKET_TAX);
  }
  var LIQUIDITY = {
    stable: { both: 0.9, spread: 0.05, swing: 0.03, selling: 0.75, activity: 0.3 },
    ok: { both: 0.75, spread: 0.15, swing: 0.08, selling: 0.3, activity: 0 }
  };
  var LIQUIDITY_HOURS = 12;
  var RATING_ORDER = { thin: 0, ok: 1, stable: 2 };
  var INPUT_BOOK_HOURS = 12;
  function liquidityRating(summary2) {
    const l2 = summary2?.liquidity;
    const swing = summary2?.a?.swing;
    if (!l2 || l2.hours < LIQUIDITY_HOURS || l2.spread === null || swing === null) return { rating: "thin", known: false, ...l2, swing: swing ?? null };
    const sales = l2.sold?.enough ? l2.sold.selling : null;
    const meets = (t4) => l2.both >= t4.both && l2.spread <= t4.spread && swing <= t4.swing && (sales !== null ? sales >= t4.selling : l2.activity >= t4.activity);
    return { rating: meets(LIQUIDITY.stable) ? "stable" : meets(LIQUIDITY.ok) ? "ok" : "thin", known: true, ...l2, swing };
  }
  var PLAN_MODES = {
    away: { hours: 8, coinShare: { stable: 0.6, ok: 0.3, thin: 0.1 }, hideThinMargins: true },
    medium: { hours: 2, coinShare: { stable: 0.7, ok: 0.4, thin: 0.15 }, hideThinMargins: false },
    active: { hours: 0.5, coinShare: { stable: 0.8, ok: 0.5, thin: 0.2 }, hideThinMargins: false }
  };
  function thinMargin(entry, swing = null) {
    if (!(entry.costPerAction > 0) || entry.margin === null || !(entry.profitPerHour > 0)) return false;
    return entry.margin < RISKY_MARGIN || swing > CALM_SWING && entry.margin < swing;
  }
  var CALM_SWING = 0.05;
  var MIN_SWING_SHARE = 0.4;
  var HIGH_PRICE_SHARE = 0.5;
  var PRICE_BAND = 0.1;
  var SALES_DAYS = 1;
  var salesDay = (liquidity2) => liquidity2?.sold?.enough ? Math.floor(SALES_DAYS * liquidity2.sold.perDay) : Infinity;
  function unitsToMake(planned, daySales, held) {
    const room = Number.isFinite(daySales) ? daySales - held : planned - held;
    return Math.max(0, Math.min(planned, room));
  }
  function swingShare(price) {
    if (!price || !(price.swing > 0)) return null;
    const bySwing = Math.min(1, Math.max(MIN_SWING_SHARE, 1 - 2 * (price.swing - CALM_SWING)));
    const high = price.diff !== null && price.diff > PRICE_BAND && price.swing > CALM_SWING;
    const low = price.diff !== null && price.diff < -PRICE_BAND;
    return { swing: price.swing, diff: price.diff, bySwing, high, low, share: bySwing * (high ? HIGH_PRICE_SHARE : 1) };
  }
  function suggestCount(entry, { stock, book = null, hours = PLAN_MODES.away.hours, coinShare = PLAN_MODES.away.coinShare, hideThinMargins = false, coins: coins10 = Infinity, have: have6 = () => 0, heldPrice = null, sellAt = "ask", price = null, liquidity: liquidity2 = null, inputMarket = null, now: now2 = Date.now() }) {
    if (entry.action.function !== "/action_functions/production" && entry.action.function !== ALCHEMY_FUNCTION || !entry.valid || !entry.mainCount) return null;
    const breakEven = breakEvenPrice(entry);
    const profitableBids = book ? book.bids.filter((o2) => o2.price >= breakEven).reduce((sum, o2) => sum + o2.quantity, 0) : null;
    const asks = book && sellAt === "ask" ? othersNearLowestAsk(book, stock) : null;
    const product = liquidity2 || { rating: "thin", known: false };
    const planned = Math.max(1, Math.floor(hours * entry.actionsPerHour));
    const plannedUnits = Math.min(planned * entry.mainCount, salesDay(product));
    const held = stock.inventory + stock.listed;
    const units = unitsToMake(planned * entry.mainCount, salesDay(product), held);
    let count3 = Math.max(0, Math.ceil(units / entry.mainCount - 1e-9));
    let short3 = units < planned * entry.mainCount ? units < plannedUnits ? "held" : "sales" : null;
    const swing = swingShare(price);
    if (swing && swing.share < 1) {
      const before = count3;
      count3 = Math.ceil(count3 * swing.share);
      if (count3 < before) short3 = "swing";
    }
    const haveOf = (input) => have6(input.itemHrid, input.enhancementLevel || 0);
    const toBuy2 = (input, n5) => input.itemHrid === COIN3 ? input.count * n5 : Math.max(0, input.count * n5 - haveOf(input));
    const minMargin = hideThinMargins ? Math.max(RISKY_MARGIN, price?.swing > CALM_SWING ? price.swing : 0) : 0;
    const limitMargin = Math.max(RISKY_MARGIN, minMargin);
    for (const input of entry.inputs) {
      if (input.forSale !== false || !(input.count > 0)) continue;
      const most = Math.floor(haveOf(input) / input.count + 1e-9);
      if (most < count3) {
        count3 = most;
        short3 = "owned";
      }
    }
    const bought = entry.inputs.filter((input) => input.itemHrid !== COIN3 && input.forSale !== false && input.count > 0 && input.price > 0 && toBuy2(input, count3) > 0);
    const profitPerAction = entry.profitPerHour / entry.actionsPerHour;
    const inputs = bought.map((input) => {
      const market = inputMarket?.(input.itemHrid, input.enhancementLevel || 0) || {};
      const fresh = market.book && now2 - market.book.at <= INPUT_BOOK_HOURS * 36e5 ? market.book : null;
      const asks2 = fresh ? [...fresh.asks].filter((o2) => o2.price > 0 && o2.quantity > 0).sort((a, b) => a.price - b.price) : null;
      const maxPrice = asks2?.length ? Math.max(asks2[0].price, input.price + (profitPerAction - minMargin * entry.revenuePerAction) / input.count) : null;
      const limitPrice = input.price + (profitPerAction - limitMargin * entry.revenuePerAction) / input.count;
      const usable = asks2 ? asks2.filter((o2) => o2.price <= maxPrice + 1e-9) : null;
      const listed = usable ? usable.reduce((sum, o2) => sum + o2.quantity, 0) : null;
      return {
        itemHrid: input.itemHrid,
        perAction: input.count,
        price: input.price,
        liquidity: market.liquidity || null,
        nearAsks: listed,
        lowestAsk: asks2?.[0]?.price ?? null,
        maxPrice,
        limitPrice,
        asks: usable,
        bookAt: fresh?.at ?? null,
        enhancementLevel: input.enhancementLevel || 0,
        maxCount: usable ? Math.floor((haveOf(input) + listed) / input.count + 1e-9) : Infinity
      };
    });
    let limitedByListing = null;
    for (const input of inputs) {
      if (!(input.enhancementLevel > 0) || input.asks) continue;
      const most = Math.floor((haveOf({ itemHrid: input.itemHrid, enhancementLevel: input.enhancementLevel }) + 1) / input.perAction + 1e-9);
      input.oneListed = true;
      if (most < count3) {
        count3 = most;
        limitedByListing = input.itemHrid;
        short3 = "onelisted";
      }
    }
    const booked = new Map(inputs.filter((i) => i.asks).map((i) => [i.itemHrid, i.asks]));
    const cost = (input, units2) => {
      const asks2 = booked.get(input.itemHrid);
      if (!asks2?.length) return units2 * (input.price || 0);
      let left = units2;
      let sum = 0;
      for (const o2 of asks2) {
        const take = Math.min(left, o2.quantity);
        sum += take * o2.price;
        left -= take;
        if (left <= 0) break;
      }
      return sum + Math.max(0, left) * asks2[asks2.length - 1].price;
    };
    const spend = (n5) => entry.inputs.reduce((sum, input) => sum + (input.forSale === false ? 0 : cost(input, toBuy2(input, n5))), 0);
    let limitedByBook = null;
    for (const input of inputs) {
      if (input.maxCount < count3) {
        count3 = input.maxCount;
        limitedByBook = input.itemHrid;
        short3 = "book";
      }
    }
    let rating = product;
    let ratedBy = null;
    for (const input of inputs) {
      if (inputMarket && RATING_ORDER[input.liquidity?.rating ?? "thin"] < RATING_ORDER[rating.rating]) {
        rating = input.liquidity || { rating: "thin", known: false };
        ratedBy = input.itemHrid;
      }
    }
    const share = coinShare[rating.rating] ?? coinShare.thin;
    const budget = coins10 * share;
    let limitedByCoins = false;
    if (spend(count3) > budget) {
      let low = 0;
      let high = count3;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (spend(mid) <= budget) low = mid;
        else high = mid - 1;
      }
      count3 = low;
      limitedByCoins = true;
      short3 = "coins";
    }
    const jobHours = count3 / entry.actionsPerHour;
    const aboveAsk = spend(count3) - entry.inputs.reduce((sum, input) => sum + (input.forSale === false ? 0 : toBuy2(input, count3) * (input.price || 0)), 0);
    const fromStock = heldUse(entry, count3, have6, heldPrice);
    const batch = {
      materials: count3 * entry.costPerAction + aboveAsk - fromStock.saving,
      aboveAsk,
      heldSaving: fromStock.saving,
      heldValue: fromStock.value,
      toBuy: spend(count3),
      revenue: count3 * entry.revenuePerAction,
      teas: entry.teaPerHour * jobHours
    };
    batch.profit = batch.revenue - batch.materials - batch.teas;
    return {
      known: true,
      breakEven,
      profitableBids,
      nearAsks: asks?.quantity ?? null,
      lowestAsk: asks?.lowest ?? null,
      bookAt: book?.at ?? null,
      stock,
      held,
      heldOff: Math.max(0, plannedUnits - units),
      plannedHours: hours,
      plannedUnits,
      short: short3,
      cappedBySales: plannedUnits < planned * entry.mainCount,
      liquidity: rating,
      productLiquidity: product,
      ratedBy,
      inputs: inputs.map(({ asks: asks2, ...input }) => {
        const units2 = Math.max(0, Math.ceil(input.perAction * count3 - have6(input.itemHrid, input.enhancementLevel) - 1e-9));
        return { ...input, toBuy: units2, averagePrice: units2 > 0 ? cost(input, units2) / units2 : null };
      }),
      minMargin,
      limitMargin,
      limitedByBook,
      limitedByListing,
      coinShare: share,
      budget,
      count: count3,
      hours: jobHours,
      fill: Math.min(1, jobHours / hours),
      batch,
      swing,
      limitedByCoins
    };
  }
  function heldValue(market, data, hrid) {
    if (hrid === COIN3) return 1;
    const bid = market.sell(hrid).bid;
    const value = bid > 0 ? bid * (1 - MARKET_TAX) : data.itemDetailMap[hrid]?.sellPrice || 0;
    const ask = market.buy(hrid);
    return ask === null ? value : Math.min(ask, value);
  }
  function heldUse(entry, n5, have6, heldPrice) {
    let value = 0;
    let saving = 0;
    if (!heldPrice) return { value, saving };
    for (const input of entry.inputs) {
      if (input.itemHrid === COIN3 || !(input.count > 0)) continue;
      const level = input.enhancementLevel || 0;
      const used = Math.min(have6(input.itemHrid, level), input.count * n5);
      if (!(used > 0)) continue;
      const worth = heldPrice(input.itemHrid, level);
      value += used * worth;
      saving += used * Math.max(0, (input.price || 0) - worth);
    }
    return { value, saving };
  }
  function enhanceBudget(entry, { hours = PLAN_MODES.away.hours, coinShare = PLAN_MODES.away.coinShare, coins: coins10 = Infinity, inputMarket = null }) {
    if (!entry.valid || entry.action.function !== ENHANCE_FUNCTION) return null;
    const rating = inputMarket?.(entry.action.itemHrid)?.liquidity || { rating: "thin", known: false };
    const share = coinShare[rating.rating] ?? coinShare.thin;
    const budget = coins10 * share;
    const item = entry.base.owned ? 0 : entry.base.price;
    const perHour = (entry.costPerAttempt * entry.actionsPerHour + entry.teaPerHour) * (entry.enhanceShare ?? 1);
    const fill = item > budget ? 0 : perHour > 0 ? Math.min(1, (budget - item) / (perHour * hours)) : 1;
    return { rating, share, budget, item, perHour, need: item + perHour * hours, fill, hours: fill * hours, plannedHours: hours };
  }
  function suggestChainCount(entry, chain, { stock, hours = PLAN_MODES.away.hours, coinShare = PLAN_MODES.away.coinShare, coins: coins10 = Infinity, price = null, liquidity: liquidity2 = null, inputMarket = null }) {
    if (!chain || !entry.mainCount || chain.profitPerHour <= 0) return null;
    const planned = Math.max(1, Math.floor(hours / chain.hoursPerAction));
    const held = stock.inventory + stock.listed;
    const units = unitsToMake(planned * entry.mainCount, salesDay(liquidity2), held);
    const heldOff = Math.max(0, Math.min(planned * entry.mainCount, salesDay(liquidity2)) - units);
    let count3 = Math.max(0, Math.ceil(units / entry.mainCount - 1e-9));
    const swing = swingShare(price);
    if (swing && swing.share < 1) count3 = Math.ceil(count3 * swing.share);
    let rating = liquidity2 || { rating: "thin", known: false };
    let ratedBy = null;
    for (const hrid of inputMarket ? chain.bought : []) {
      const own = inputMarket(hrid)?.liquidity || { rating: "thin", known: false };
      if (RATING_ORDER[own.rating] < RATING_ORDER[rating.rating]) {
        rating = own;
        ratedBy = hrid;
      }
    }
    const share = coinShare[rating.rating] ?? coinShare.thin;
    const budget = coins10 * share;
    const limitedByCoins = chain.cashPerAction > 0 && count3 * chain.cashPerAction > budget;
    if (limitedByCoins) count3 = Math.floor(budget / chain.cashPerAction);
    return { count: count3, hours: count3 * chain.hoursPerAction, cash: count3 * chain.cashPerAction, liquidity: rating, ratedBy, coinShare: share, budget, limitedByCoins, held, heldOff };
  }
  function chainBuilder(who, data, market, teaMode) {
    const sources = /* @__PURE__ */ new Map();
    for (const action of skillingActions(data)) {
      const made = action.outputItems?.length ? action.outputItems.map((o2) => o2.itemHrid) : (action.dropTable || []).map((d) => d.itemHrid);
      for (const hrid of made) {
        if (!sources.has(hrid)) sources.set(hrid, []);
        sources.get(hrid).push(action);
      }
    }
    const runs = /* @__PURE__ */ new Map();
    const run = (action) => {
      if (!runs.has(action.hrid)) {
        const plain = (teas) => daily(evaluateAction(action, who, data, market, teas));
        runs.set(action.hrid, teaMode === "best" ? bestTeas(action, who, data, market, plain).result : plain(who.drinks[action.type] || []));
      }
      return runs.get(action.hrid);
    };
    const units = /* @__PURE__ */ new Map();
    const selfMade = (itemHrid, seen) => {
      if (units.has(itemHrid)) return units.get(itemHrid);
      if (seen.has(itemHrid)) return null;
      let best = null;
      for (const action of sources.get(itemHrid) || []) {
        if ((who.levels[action.levelRequirement.skillHrid] ?? 1) < action.levelRequirement.level) continue;
        const r = run(action);
        const out = r.outputs.find((o2) => o2.itemHrid === itemHrid && o2.kind === "product");
        if (!out || out.count <= 0) continue;
        const inner = materials2(r, /* @__PURE__ */ new Set([...seen, itemHrid]));
        if (!inner) continue;
        const ownHours = 1 / (r.actionsPerHour * out.count);
        const unit = {
          itemHrid,
          action,
          cost: (inner.cost + r.teaPerHour / r.actionsPerHour - (r.revenuePerAction - out.value)) / out.count,
          ownHours,
          hours: ownHours + inner.hours / out.count,
          steps: inner.steps.map((step) => ({ ...step, count: step.count / out.count }))
        };
        if (!best || unit.hours < best.hours) best = unit;
      }
      units.set(itemHrid, best);
      return best;
    };
    const materials2 = (r, seen) => {
      let cost = 0;
      let hours = 0;
      const steps = [];
      for (const input of r.inputs) {
        const made = selfMade(input.itemHrid, seen);
        if (made) {
          cost += made.cost * input.count;
          hours += made.hours * input.count;
          steps.push({ itemHrid: input.itemHrid, count: input.count, made });
        } else if (input.price === null) {
          return null;
        } else {
          cost += input.value;
          steps.push({ itemHrid: input.itemHrid, count: input.count, price: input.price });
        }
      }
      return { cost, hours, steps };
    };
    const timeShares = (steps, factor, out) => {
      for (const step of steps) {
        if (!step.made) continue;
        const share = out.get(step.itemHrid) || { itemHrid: step.itemHrid, action: step.made.action, count: 0, hours: 0 };
        share.count += step.count * factor;
        share.hours += step.made.ownHours * step.count * factor;
        out.set(step.itemHrid, share);
        timeShares(step.made.steps, step.count * factor, out);
      }
      return out;
    };
    const boughtItems = (steps, out) => {
      for (const step of steps) {
        if (step.made) boughtItems(step.made.steps, out);
        else out.add(step.itemHrid);
      }
      return out;
    };
    return (entry) => {
      if (entry.action.function !== "/action_functions/production" || !entry.valid) return null;
      const inner = materials2(entry, /* @__PURE__ */ new Set([entry.action.outputItems?.[0]?.itemHrid]));
      if (!inner || !inner.steps.some((step) => step.made)) return null;
      const craftHours = 1 / entry.actionsPerHour;
      const hours = craftHours + inner.hours;
      const profit = entry.revenuePerAction - inner.cost - entry.teaPerHour / entry.actionsPerHour;
      return {
        hoursPerAction: hours,
        craftShare: craftHours / hours,
        shares: [...timeShares(inner.steps, 1, /* @__PURE__ */ new Map()).values()].map((share) => ({ ...share, share: share.hours / hours })),
        bought: [...boughtItems(inner.steps, /* @__PURE__ */ new Set())],
        profitPerHour: profit / hours,
        goldPerDay: profit / hours * HOURS_PER_DAY,
        cashPerAction: inner.cost
      };
    };
  }
  function decomposeFinisher(who, data, market) {
    const cache = /* @__PURE__ */ new Map();
    const teas = who.drinks?.["/action_types/alchemy"] || [];
    return (itemHrid, level) => {
      const key2 = `${itemHrid}#${level}`;
      if (cache.has(key2)) return cache.get(key2);
      let fin = null;
      const detail = data.itemDetailMap[itemHrid];
      if (level >= 0 && decomposesEnhanced(detail) && who.levels?.["/skills/alchemy"] !== void 0) {
        const r = evaluateAlchemy(decomposeAction(detail, level), who, data, market, teas, { itemPrice: 0 });
        if (r.valid && r.actionsPerHour > 0) fin = { kind: "decompose", value: r.profitPerHour / r.actionsPerHour, hours: 1 / r.actionsPerHour, xp: r.xpPerAction, entry: r };
      }
      cache.set(key2, fin);
      return fin;
    };
  }
  var REUSED_MARKET = { rating: "stable", known: true, reused: true };
  function decomposeCraft(entry, who, data, market) {
    if (entry.action.function !== "/action_functions/production" || !entry.valid || entry.decomposeCraft) return null;
    const hrid = entry.action.outputItems?.[0]?.itemHrid;
    const detail = data.itemDetailMap[hrid];
    const out = entry.outputs.find((o2) => o2.itemHrid === hrid && o2.kind === "product");
    if (!out || !(out.count > 0) || !detail?.alchemyDetail?.decomposeItems?.length || who.levels?.["/skills/alchemy"] === void 0) return null;
    const r = evaluateAlchemy(decomposeAction(detail, 0), who, data, market, who.drinks?.["/action_types/alchemy"] || [], { itemPrice: 0 });
    if (!r.valid || !(r.actionsPerHour > 0)) return null;
    const per = out.count / r.bulk;
    const inputs = entry.inputs.map((i) => ({ ...i }));
    const reused = [];
    const sold = [];
    for (const o2 of r.outputs) {
      let n5 = o2.count * per;
      const input = inputs.find((i) => i.itemHrid === o2.itemHrid && i.count > 0);
      if (input) {
        const take = Math.min(n5, input.count);
        input.count -= take;
        input.value = input.count * (input.price || 0);
        reused.push({ itemHrid: o2.itemHrid, count: take, price: input.price || 0 });
        n5 -= take;
      }
      if (n5 > 1e-12) sold.push({ ...o2, count: n5, value: n5 * o2.price, kind: o2.kind === "product" ? "recovered" : o2.kind });
    }
    const coins10 = r.coinCost * per;
    const catalyst = r.inputs.find((i) => i.catalyst);
    if (coins10 > 0) inputs.push({ itemHrid: COIN3, count: coins10, price: 1, value: coins10 });
    if (catalyst) inputs.push({ ...catalyst, count: catalyst.count * per, value: catalyst.value * per });
    const craftHours = 1 / entry.actionsPerHour;
    const alchemyHours = per / r.actionsPerHour;
    const share = craftHours / (craftHours + alchemyHours);
    const back = reused.reduce((sum, x) => sum + x.count * x.price, 0) + sold.reduce((sum, x) => sum + x.value, 0) - coins10 - (catalyst ? catalyst.value * per : 0) - r.teaPerHour * alchemyHours;
    const valuePerItem = back / out.count;
    if (!(valuePerItem > out.price)) return null;
    const outputs = [...entry.outputs.map((o2) => o2 === out ? { ...o2, price: 0, value: 0, decomposed: true } : o2), ...sold];
    const revenuePerAction = outputs.reduce((sum, o2) => sum + o2.value, 0);
    const costPerAction = inputs.reduce((sum, i) => sum + i.value, 0);
    const actionsPerHour = entry.actionsPerHour * share;
    const teaPerHour = entry.teaPerHour * share + r.teaPerHour * (1 - share);
    const profitPerHour = actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour;
    const xpPerHour = actionsPerHour * entry.xpPerAction;
    return {
      ...entry,
      single: entry,
      outputs,
      inputs,
      actionsPerHour,
      ownActionsPerHour: entry.actionsPerHour,
      teaPerHour,
      revenuePerAction,
      costPerAction,
      profitPerHour,
      goldPerDay: profitPerHour * HOURS_PER_DAY,
      margin: revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null,
      xpPerHour,
      xpPerDay: xpPerHour * HOURS_PER_DAY,
      salesCap: null,
      decomposeCraft: { share, per, reused, sold, valuePerItem, sellPrice: out.price, decompose: r, singleGoldPerDay: entry.goldPerDay, alchemyXpPerHour: actionsPerHour * per * r.xpPerAction }
    };
  }
  var leveling = (action) => action.function === ENHANCE_FUNCTION || action.function === ALCHEMY_FUNCTION;
  var sameTeas = (a, b) => a.length === b.length && a.every((hrid) => b.includes(hrid));
  var SHORTLIST = 40;
  function shortlist(candidates, keep2 = () => false) {
    if (candidates.length <= 3 * SHORTLIST) return candidates;
    const tried = candidates.map((c2) => {
      const gold = c2.evaluate([], (r) => r.goldPerDay);
      const xp = c2.evaluate([], (r) => r.xpPerDay);
      const cheap = c2.evaluate([], (r) => -coinsPerXp(r));
      return { c: c2, gold: gold.valid ? gold.goldPerDay : -Infinity, xp: xp.valid ? xp.xpPerDay : -Infinity, perCoin: -coinsPerXp(cheap) };
    });
    const kept2 = new Set(candidates.filter(keep2));
    for (const key2 of ["gold", "xp", "perCoin"]) [...tried].sort((a, b) => b[key2] - a[key2]).slice(0, SHORTLIST).forEach((t4) => kept2.add(t4.c));
    return candidates.filter((c2) => kept2.has(c2));
  }
  function rankSkilling(who, data, market, { skill = "all", teaMode = "current", plan = null, goldWeight = 1, countLevels = false, leveling: levelingOptions2 = {} } = {}) {
    var _a;
    const xpOf = levelProgress(who, data, countLevels);
    const alchemyOptions = { plusBuy: levelingOptions2.plusBuy, plusHeld: levelingOptions2.plusHeld };
    const finish = decomposeFinisher(who, data, market);
    const evaluator = (action, level) => {
      const target = levelingOptions2.fixed?.hrid === action.hrid ? levelingOptions2.fixed.target : null;
      if (action.function === ENHANCE_FUNCTION) return (teas, score3) => evaluateEnhance(action, who, data, market, teas, { ...levelingOptions2, score: score3, target, finish });
      if (action.function === ALCHEMY_FUNCTION) return (teas, score3) => evaluateAlchemy(action, who, data, market, teas, { ...alchemyOptions, score: score3 });
      return (teas) => daily(evaluateAction(action, who, data, market, teas, level));
    };
    const wanted = (action) => skill === "all" || action.type === skillType(skill);
    const doable = [];
    const near = [];
    for (const action of skillingActions(data)) {
      if (!wanted(action) || who.levels[action.levelRequirement.skillHrid] === void 0) continue;
      const level = who.levels[action.levelRequirement.skillHrid];
      const required = action.levelRequirement.level;
      if (required <= level) {
        doable.push({ action, evaluate: evaluator(action, level) });
      } else if (required <= level + NEAR_LEVELS) {
        near.push(action);
      }
    }
    const levelingList = skill === ENHANCING || skill === ALCHEMY;
    const owned = (c2) => (levelingOptions2.owned?.(c2.action.itemHrid, c2.action.enhancementLevel || 0) || 0) > 0 || c2.action.hrid === levelingOptions2.fixed?.hrid;
    if (skill === ENHANCING) doable.push(...shortlist(enhancingActions(data, market, (hrid) => levelingOptions2.owned?.(hrid, 0) || 0).map((action) => ({ action, evaluate: evaluator(action) })), owned));
    if (skill === ALCHEMY) doable.push(...shortlist(alchemyActions(data, market, levelingOptions2.plusLevels).map((action) => ({ action, evaluate: evaluator(action) })), owned));
    const XP_FLOOR = countLevels ? 1e-6 : 1;
    const refs = { gold: 1, xp: XP_FLOOR };
    const skillRefs = {};
    const NO_STOCK = { inventory: 0, listed: 0, listings: [] };
    const fillOf = (r) => {
      if (!plan) return 1;
      if (r.action.function === ENHANCE_FUNCTION) return enhanceBudget(r, plan)?.fill ?? 1;
      return suggestCount(r, { ...plan, stock: NO_STOCK, book: null, price: plan.price?.(r.action) ?? null, liquidity: plan.liquidity?.(r.action) ?? null })?.fill ?? 1;
    };
    for (const { action, evaluate } of doable) {
      const own = skillRefs[_a = action.type] || (skillRefs[_a] = { gold: 1, xp: XP_FLOOR, cost: Infinity });
      const gold = bestTeas(action, who, data, market, evaluate, leveling(action) ? (r) => -coinsPer(r, xpOf) : (r) => r.goldPerDay).result;
      const xp = bestTeas(action, who, data, market, evaluate, xpOf).result;
      const goldDay = gold.valid ? gold.goldPerDay * fillOf(gold) : 0;
      const xpDay = xp.valid ? xpOf({ ...xp, xpPerDay: xp.xpPerDay * fillOf(xp) }) : 0;
      for (const r of [refs, own]) {
        r.gold = Math.max(r.gold, goldDay);
        r.xp = Math.max(r.xp, xpDay);
        if (leveling(action)) r.cost = Math.min(r.cost, coinsPer(gold, xpOf));
      }
    }
    const scoreFor = (r) => levelingList ? timeMoneyScore(goldWeight, r, xpOf) : focusScore(goldWeight, r, xpOf);
    const score2 = scoreFor(refs);
    const chain = chainBuilder(who, data, market, teaMode);
    const chainCaches = /* @__PURE__ */ new Map();
    const heldPrice = (hrid, level = 0) => level > 0 ? levelingOptions2.plusHeld?.(hrid, level) || 0 : heldValue(market, data, hrid);
    const available = doable.map(({ action, evaluate }) => {
      const teaScore = scoreFor(skillRefs[action.type]);
      const current = evaluate(who.drinks[action.type] || [], teaScore);
      const best = bestTeas(action, who, data, market, evaluate, teaScore);
      let shown = teaMode === "best" ? best.result : current;
      if (action.function === ALCHEMY_FUNCTION) {
        const chained2 = alchemyChain(shown, who, data, market, chainCaches);
        if (chained2 && teaScore(chained2) > teaScore(shown) + 1e-12) shown = chained2;
      }
      const recycled = decomposeCraft(shown, who, data, market);
      if (recycled && teaScore(recycled) > teaScore(shown) + 1e-12) shown = recycled;
      const recycling = !!shown.decomposeCraft;
      const price = recycling ? null : plan?.price?.(shown.action) ?? null;
      const liquidity2 = recycling ? REUSED_MARKET : plan?.liquidity?.(shown.action) ?? null;
      const stock = action.function === ALCHEMY_FUNCTION || recycling ? NO_STOCK : plan?.stock(shown.action);
      const suggestion = plan ? suggestCount(shown, { ...plan, stock, book: recycling ? null : plan.book(shown.action), price, liquidity: liquidity2, heldPrice }) : null;
      const budget = plan ? enhanceBudget(shown, plan) : null;
      const fill = suggestion ? suggestion.fill : budget ? budget.fill : 1;
      const upTheBook = ((suggestion?.batch.aboveAsk || 0) - (suggestion?.batch.heldSaving || 0)) * 24 / (suggestion?.plannedHours || 1);
      const chained = recycling ? null : chain(shown);
      const entry = {
        ...shown,
        teaMode,
        current,
        best,
        suggestion,
        budget,
        chain: chained,
        // The share of the planned hours the job runs: what the ranking goes by.
        fill,
        // Gold a day over the planned hours: what the ranking goes by.
        plannedGoldPerDay: shown.goldPerDay * fill - upTheBook,
        // A train that makes the materials too, when that pays at least as well as buying them.
        chainSuggestion: plan && chained && chained.profitPerHour >= shown.profitPerHour ? suggestChainCount(shown, chained, { ...plan, stock: plan.stock(shown.action), price, liquidity: liquidity2 }) : null,
        score: score2({ skill: shown.skill, valid: shown.valid, goldPerDay: shown.goldPerDay * fill - upTheBook, xpPerDay: shown.xpPerDay * fill }),
        levelsPerDay: countLevels ? levelProgress(who, data, true)(shown) : null,
        thinMargin: !!plan?.hideThinMargins && thinMargin(shown, price?.swing ?? null),
        teaSlots: who.slots[action.type],
        pouch: who.pouch,
        betterTeas: !sameTeas(best.result.teas, current.teas) && teaScore(best.result) > teaScore(current) + 1e-9
      };
      if (plan) {
        const runs = action.function === "/action_functions/gathering" || action.function === ENHANCE_FUNCTION;
        const hours = suggestion?.count ? suggestion.count / best.result.actionsPerHour : budget ? budget.hours : runs ? plan.hours : 0;
        entry.teaPlan = teaPurchase(entry, { hours, have: plan.have });
      }
      return entry;
    });
    available.sort((a, b) => b.valid - a.valid || a.thinMargin - b.thinMargin || b.score - a.score);
    const fastestXp = {};
    for (const entry of available) fastestXp[entry.skill] = Math.max(fastestXp[entry.skill] || 0, entry.current.xpPerHour);
    const table = data.levelExperienceTable;
    const upcoming = near.map((action) => {
      const skillHrid = action.levelRequirement.skillHrid;
      const required = action.levelRequirement.level;
      const evaluate = evaluator(action, required);
      const atUnlock = teaMode === "best" ? bestTeas(action, who, data, market, evaluate).result : evaluate(who.drinks[action.type] || []);
      const have6 = who.experience[skillHrid];
      const needXp = Array.isArray(table) && have6 !== null && table[required] !== void 0 ? Math.max(0, table[required] - have6) : null;
      const hours = needXp !== null && fastestXp[skillHrid] > 0 ? needXp / fastestXp[skillHrid] : null;
      return { ...atUnlock, needLevels: required - (who.levels[skillHrid] ?? 1), needXp, hoursToUnlock: hours };
    });
    upcoming.sort((a, b) => a.needLevels - b.needLevels || b.goldPerDay - a.goldPerDay);
    return { available, upcoming };
  }

  // src/format.js
  function parseCoins(text) {
    const cleaned = String(text).trim().toLowerCase().replace(/\s+/g, "");
    const match = cleaned.match(/^(\d+(?:[.,]\d+)?|\d{1,3}(?:[.,]\d{3})+)([kmb]?)$/);
    if (!match) return null;
    const [, number, suffix] = match;
    const value = suffix ? Number(number.replace(",", ".")) : Number(number.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."));
    const factor = { "": 1, k: 1e3, m: 1e6, b: 1e9 }[suffix];
    return Number.isFinite(value) ? Math.round(value * factor) : null;
  }
  function coinsInput(n5) {
    if (n5 >= 1e9 && n5 % 1e7 === 0) return n5 / 1e9 + "B";
    if (n5 >= 1e6 && n5 % 1e4 === 0) return n5 / 1e6 + "M";
    if (n5 >= 1e3 && n5 % 10 === 0) return n5 / 1e3 + "k";
    return String(n5);
  }
  function shortCoins(n5) {
    const abs = Math.abs(n5);
    const fixed = (value, digits) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (abs >= 1e9) return fixed(n5 / 1e9, 2) + "B";
    if (abs >= 1e6) return fixed(n5 / 1e6, abs >= 1e7 ? 1 : 2) + "M";
    if (abs >= 1e4) return fixed(n5 / 1e3, abs >= 1e5 ? 0 : 1) + "k";
    return Math.round(n5).toLocaleString("en-US");
  }
  var esc = (s2) => String(s2 ?? "").replace(/[&<>"']/g, (c2) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c2]);

  // src/skilling-upgrades.js
  var MAX_HOUSE_LEVEL = 8;
  var UPGRADES_SHOWN = 10;
  var GATHERING_SKILLS = /* @__PURE__ */ new Set(["milking", "foraging", "woodcutting"]);
  function itemSkillBuffs(itemHrid, enhancementLevel, skill, data) {
    const detail = data.itemDetailMap[itemHrid]?.equipmentDetail;
    const stats = detail?.noncombatStats || {};
    const bonuses = detail?.noncombatEnhancementBonuses || {};
    const multiplier = data.enhancementLevelTotalBonusMultiplierTable?.[enhancementLevel || 0] || 0;
    const value = (stat) => (stats[stat] || 0) + (bonuses[stat] || 0) * multiplier;
    const buffs = [];
    const add = (typeHrid, amount2) => amount2 && buffs.push({ typeHrid, flatBoost: amount2, ratioBoost: 0 });
    add("/buff_types/action_speed", value(skill + "Speed") + value("skillingSpeed"));
    add("/buff_types/efficiency", value(skill + "Efficiency") + value("skillingEfficiency"));
    add("/buff_types/wisdom", value(skill + "Experience") + value("skillingExperience"));
    add("/buff_types/rare_find", value(skill + "RareFind") + value("skillingRareFind"));
    add("/buff_types/essence_find", value(skill + "EssenceFind") + value("skillingEssenceFind"));
    add(`/buff_types/${skill}_success`, value(skill + "Success"));
    if (GATHERING_SKILLS.has(skill)) add("/buff_types/gathering", value("gatheringQuantity"));
    return { buffs, concentration: value("drinkConcentration") };
  }
  var negate = (buffs) => buffs.map((b) => ({ ...b, flatBoost: -b.flatBoost }));
  var location = (itemHrid, data) => "/item_locations/" + (data.itemDetailMap[itemHrid]?.equipmentDetail?.type || "").split("/").pop();
  function bestDay(actions, who, data, market) {
    let best = null;
    for (const action of actions) {
      const r = daily(evaluateAction(action, who, data, market));
      if (r.valid && (!best || r.goldPerDay > best.goldPerDay)) best = r;
    }
    return best;
  }
  function bestDayWithTeas(actions, who, data, market) {
    let best = null;
    for (const action of actions) {
      const evaluate = (teas) => daily(evaluateAction(action, who, data, market, teas));
      const r = bestTeas(action, who, data, market, evaluate).result;
      if (r.valid && (!best || r.goldPerDay > best.goldPerDay)) best = r;
    }
    return best;
  }
  function skillActions(who, data, skill, actionHrid = null) {
    const type = skillType(skill);
    const actions = skillingActions(data).filter((a) => a.type === type && (who.levels[a.levelRequirement.skillHrid] ?? 1) >= a.levelRequirement.level);
    const chosen = actionHrid && actions.find((a) => a.hrid === actionHrid);
    return chosen ? [chosen] : actions;
  }
  function measure(who, data, market, skill, actionHrid, leveling2) {
    if (skill !== ENHANCING && skill !== ALCHEMY) {
      const actions = skillActions(who, data, skill, actionHrid);
      return { worth: (r) => r.goldPerDay, xpPrice: 0, day: (w) => bestDay(actions, w, data, market), dayWithTeas: (w) => bestDayWithTeas(actions, w, data, market) };
    }
    const enhancing = skill === ENHANCING;
    const owned = (hrid) => leveling2.owned?.(hrid, 0) || 0;
    const action = actionHrid && (enhancing ? enhancingActions(data, market, owned) : alchemyActions(data, market, leveling2.plusLevels)).find((a) => a.hrid === actionHrid);
    if (!action) return null;
    const finish = enhancing ? decomposeFinisher(who, data, market) : null;
    const evaluate = (w, teas, score2) => enhancing ? evaluateEnhance(action, w, data, market, teas, { resale: leveling2.resale, owned, score: score2, finish }) : evaluateAlchemy(action, w, data, market, teas, { score: score2, plusBuy: leveling2.plusBuy, plusHeld: leveling2.plusHeld });
    const plain = evaluate(who, who.drinks[action.type] || [], (r) => -(r.coinsPerXp ?? Infinity));
    const xpPrice = Math.max(0, leveling2.xpPrice ?? plain.coinsPerXp ?? 0);
    const worth = (r) => r.goldPerDay + xpPrice * r.xpPerDay;
    const valid = (r) => r.valid ? r : null;
    return {
      worth,
      xpPrice,
      day: (w) => valid(evaluate(w, w.drinks[action.type] || [], worth)),
      dayWithTeas: (w) => valid(bestTeas(action, w, data, market, (teas, score2) => evaluate(w, teas, score2), worth).result)
    };
  }
  function resaleValue(itemHrid, level, ownBid, data, bids = null) {
    if (ownBid > 0) return { value: ownBid * (1 - MARKET_TAX), bidLevel: level };
    const lower = (bids?.(itemHrid) || []).filter((b) => b.bid > 0 && b.enhancementLevel < level).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
    if (lower) return { value: lower.bid * (1 - MARKET_TAX), bidLevel: lower.enhancementLevel };
    return { value: data.itemDetailMap[itemHrid]?.sellPrice || 0, bidLevel: null };
  }
  function swapGain(who, data, market, skill, current, itemHrid, enhancementLevel = 0, actionHrid = null) {
    const type = skillType(skill);
    const actions = skillActions(who, data, skill, actionHrid);
    const base = bestDay(actions, who, data, market);
    if (!base) return null;
    const old = current ? itemSkillBuffs(current.itemHrid, current.enhancementLevel, skill, data) : { buffs: [], concentration: 0 };
    const next = itemSkillBuffs(itemHrid, enhancementLevel, skill, data);
    const after = bestDay(actions, { ...who, buffs: { ...who.buffs || {}, [type]: [...who.buffs?.[type] || [], ...negate(old.buffs), ...next.buffs] }, concentration: who.concentration + next.concentration - old.concentration }, data, market);
    return { gainPerDay: after.goldPerDay - base.goldPerDay, xpPerDay: after.xpPerDay - base.xpPerDay, bestAction: after.action };
  }
  function rankUpgrades(who, data, market, skill, { equipped, owned, listings, bids = null, houseLevels, gameEquipmentBuffs = null, actionHrid = null, leveling: leveling2 = {} }) {
    const type = skillType(skill);
    const m2 = measure(who, data, market, skill, actionHrid, leveling2);
    const base = m2?.day(who);
    if (!base) return { base: null, upgrades: [], check: null };
    const { worth, xpPrice } = m2;
    const withBuffs = (extra, concentration = 0, slots = who.slots[type]) => ({
      ...who,
      buffs: { ...who.buffs || {}, [type]: [...who.buffs?.[type] || [], ...extra] },
      concentration: who.concentration + concentration,
      slots: { ...who.slots, [type]: slots }
    });
    const POUCH_SLOT = "/item_locations/pouch";
    let teaBase = null;
    const meets = (itemHrid) => (data.itemDetailMap[itemHrid]?.equipmentDetail?.levelRequirements || []).every((req) => (who.levels[req.skillHrid] ?? 0) >= req.level);
    const upgrades = [];
    for (const item of Object.values(data.itemDetailMap)) {
      const detail = item.equipmentDetail;
      if (!detail?.noncombatStats || !meets(item.hrid)) continue;
      const slot = location(item.hrid, data);
      const slotsAfter = slot === POUCH_SLOT ? drinkSlots(item.hrid, data) : who.slots[type];
      const moreSlots = slotsAfter > who.slots[type];
      if (!itemSkillBuffs(item.hrid, 0, skill, data).buffs.length && !detail.noncombatStats.drinkConcentration && !moreSlots) continue;
      const current = equipped[slot] || null;
      const old = current ? itemSkillBuffs(current.itemHrid, current.enhancementLevel, skill, data) : { buffs: [], concentration: 0 };
      const offers = [...(owned[item.hrid] || []).map((level2) => ({ enhancementLevel: level2, price: 0, owned: true })), ...listings(item.hrid) || []];
      const seen = /* @__PURE__ */ new Set();
      for (const offer of offers) {
        const key2 = offer.enhancementLevel;
        if (seen.has(key2)) continue;
        seen.add(key2);
        if (current && current.itemHrid === item.hrid && current.enhancementLevel >= offer.enhancementLevel) continue;
        const next = itemSkillBuffs(item.hrid, offer.enhancementLevel, skill, data);
        const changed2 = withBuffs([...negate(old.buffs), ...next.buffs], next.concentration - old.concentration, Math.max(slotsAfter, who.drinks[type]?.length || 0));
        let after;
        let from = base;
        if (slotsAfter !== who.slots[type]) {
          teaBase || (teaBase = m2.dayWithTeas(who));
          from = teaBase;
          after = m2.dayWithTeas(changed2);
        } else after = m2.day(changed2);
        if (!after || !from) continue;
        const gain = worth(after) - worth(from);
        if (gain <= 1) continue;
        const sold = offer.owned ? { value: 0, bidLevel: null } : resaleValue(item.hrid, offer.enhancementLevel, offer.bid, data, bids);
        const resale = sold.value;
        const cost = Math.max(0, offer.price - resale);
        upgrades.push({
          kind: "item",
          itemHrid: item.hrid,
          enhancementLevel: offer.enhancementLevel,
          owned: !!offer.owned,
          price: offer.price,
          resale,
          resaleLevel: sold.bidLevel,
          cost,
          replaces: current,
          gainPerDay: gain,
          goldPerDay: after.goldPerDay - from.goldPerDay,
          xpPerDay: after.xpPerDay - from.xpPerDay,
          xpPerDayAfter: after.xpPerDay,
          paybackDays: cost / gain,
          bestAction: after.action,
          target: after.target ?? null,
          extraSlots: slotsAfter - who.slots[type],
          teas: slotsAfter !== who.slots[type] ? after.teas : null
        });
      }
    }
    const room = Object.values(data.houseRoomDetailMap || {}).find((r) => r.skillHrid === "/skills/" + skill);
    const level = room ? houseLevels[room.hrid] || 0 : MAX_HOUSE_LEVEL;
    if (room && level < MAX_HOUSE_LEVEL) {
      const step = [...room.actionBuffs || [], ...room.globalBuffs || []].map((b) => ({ typeHrid: b.typeHrid, flatBoost: (level === 0 ? b.flatBoost : b.flatBoostLevelBonus) || 0, ratioBoost: (level === 0 ? b.ratioBoost : b.ratioBoostLevelBonus) || 0 }));
      const after = m2.day(withBuffs(step));
      const costs = room.upgradeCostsMap?.[String(level + 1)] || [];
      const priced = costs.map((c2) => ({ itemHrid: c2.itemHrid, count: c2.count, price: market.buy(c2.itemHrid) }));
      const price = priced.some((c2) => c2.price === null) ? null : priced.reduce((sum, c2) => sum + c2.count * c2.price, 0);
      const gain = after ? worth(after) - worth(base) : 0;
      if (gain > 1) {
        upgrades.push({ kind: "house", roomHrid: room.hrid, name: room.name, level: level + 1, price, materials: priced, gainPerDay: gain, goldPerDay: after.goldPerDay - base.goldPerDay, xpPerDay: after.xpPerDay - base.xpPerDay, paybackDays: price === null ? null : price / gain, bestAction: after.action, target: after.target ?? null });
      }
    }
    for (const u of upgrades) {
      if (u.kind !== "item") continue;
      const lower = upgrades.filter((o2) => o2.kind === "item" && o2.itemHrid === u.itemHrid && o2.enhancementLevel < u.enhancementLevel).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
      if (!lower) continue;
      const gain = u.gainPerDay - lower.gainPerDay;
      const cost = u.cost - lower.cost;
      u.step = { from: lower.enhancementLevel, price: u.price - lower.price, cost, gainPerDay: gain, paybackDays: gain > 1 ? Math.max(0, cost) / gain : null };
    }
    upgrades.sort((a, b) => (a.paybackDays ?? Infinity) - (b.paybackDays ?? Infinity));
    const outlived = [];
    const kept2 = upgrades.filter((u) => {
      const next = u.kind === "item" && u.paybackDays > 0 ? nextTierFor(u, who, data, listings) : null;
      if (!next || !(u.paybackDays > next.days)) return true;
      outlived.push({ ...u, nextTier: next });
      return false;
    });
    let check = null;
    if (gameEquipmentBuffs) {
      const game = (gameEquipmentBuffs[type] || []).filter((b) => b.typeHrid === "/buff_types/action_speed").reduce((sum, b) => sum + (b.flatBoost || 0) + (b.ratioBoost || 0), 0);
      const mine2 = Object.values(equipped).reduce((sum, e2) => sum + itemSkillBuffs(e2.itemHrid, e2.enhancementLevel, skill, data).buffs.filter((b) => b.typeHrid === "/buff_types/action_speed").reduce((s2, b) => s2 + b.flatBoost, 0), 0);
      check = { game, mine: mine2, matches: Math.abs(game - mine2) < 5e-3 };
    }
    return { base, upgrades: kept2, outlived, check, xpPrice };
  }
  function nextTierFor(u, who, data, listings) {
    const detail = data.itemDetailMap[u.itemHrid]?.equipmentDetail;
    const req = detail?.levelRequirements?.[0];
    const table = data.levelExperienceTable;
    if (!req || !/_tool$/.test(detail.type || "") || !Array.isArray(table) || !(u.xpPerDayAfter > 0)) return null;
    let next = null;
    for (const item of Object.values(data.itemDetailMap)) {
      const r = item.equipmentDetail?.type === detail.type ? item.equipmentDetail.levelRequirements?.[0] : null;
      if (r && r.skillHrid === req.skillHrid && r.level > req.level && (!next || r.level < next.level)) next = { itemHrid: item.hrid, level: r.level };
    }
    if (!next || (who.levels[req.skillHrid] ?? 0) >= next.level || !(table[next.level] > 0)) return null;
    if (!(listings(next.itemHrid) || []).some((o2) => o2.enhancementLevel >= u.enhancementLevel && o2.price > 0)) return null;
    const xp = who.experience?.[req.skillHrid];
    if (!Number.isFinite(xp)) return null;
    return { ...next, days: Math.max(0, table[next.level] - xp) / u.xpPerDayAfter };
  }
  function toolTiers(who, data, market, { equipped, owned, actionFor = () => null }) {
    const tiers = /* @__PURE__ */ new Map();
    for (const item of Object.values(data.itemDetailMap)) {
      const detail = item.equipmentDetail;
      const req = detail?.levelRequirements?.[0];
      if (!detail || !/_tool$/.test(detail.type) || !req) continue;
      if (!tiers.has(detail.type)) tiers.set(detail.type, []);
      tiers.get(detail.type).push({ itemHrid: item.hrid, skillHrid: req.skillHrid, level: req.level });
    }
    const notices2 = [];
    for (const [type, tools] of tiers) {
      const slot = location(tools[0].itemHrid, data);
      const current = equipped[slot] || null;
      const meets = (tool) => (data.itemDetailMap[tool.itemHrid].equipmentDetail.levelRequirements || []).every((r) => (who.levels[r.skillHrid] ?? 0) >= r.level);
      const best = tools.filter(meets).sort((a, b) => b.level - a.level)[0];
      const wearing = current ? tools.find((tool) => tool.itemHrid === current.itemHrid) : null;
      if (!best || wearing && wearing.level >= best.level) continue;
      const skill = best.skillHrid.split("/").pop();
      const gain = SKILLING_SKILLS.includes(skill) ? swapGain(who, data, market, skill, current, best.itemHrid, 0, actionFor(skill)) : null;
      const isOwned = !!owned[best.itemHrid]?.length;
      const price = isOwned ? 0 : market.buy(best.itemHrid);
      const resale = isOwned ? 0 : resaleValue(best.itemHrid, 0, market.sell(best.itemHrid).bid, data).value;
      notices2.push({
        type,
        skill,
        skillLevel: who.levels[best.skillHrid] ?? 0,
        current,
        itemHrid: best.itemHrid,
        level: best.level,
        owned: isOwned,
        price,
        gainPerDay: gain?.gainPerDay ?? null,
        xpPerDay: gain?.xpPerDay ?? null,
        paybackDays: gain && gain.gainPerDay > 1 && price !== null ? Math.max(0, price - resale) / gain.gainPerDay : null
      });
    }
    return notices2.sort((a, b) => a.skill.localeCompare(b.skill));
  }

  // src/price-history.js
  var DB_NAME = "mwia-price-history";
  var HOURLY = "hourly";
  var DAILY = "daily";
  var META = "meta";
  var HOURLY_DAYS = 14;
  var DAILY_DAYS = 366;
  var HOUR_MS = 3600 * 1e3;
  var COLLECT_EVERY_MS = 30 * 60 * 1e3;
  var USUAL_BAND = 0.1;
  var TREND_BAND = 0.05;
  var MIN_HOURS = 12;
  var MIN_DAYS = 2;
  var historyKey = (itemHrid, level = 0) => level ? `${itemHrid}+${level}` : itemHrid;
  var HOURLY_FIELDS = ["a", "b", "p", "v"];
  var DAILY_FIELDS = ["a", "b", "aLow", "aHigh", "bLow", "bHigh", "n", "p", "v", "vn"];
  var COUNTS = /* @__PURE__ */ new Set(["n", "vn"]);
  var hasValue = (v) => Number.isFinite(v) && v !== 0;
  var same = (x, y) => x === y || Number.isNaN(x) && Number.isNaN(y);
  var emptyOf = (field, count3) => COUNTS.has(field) ? new Uint8Array(count3) : new Float32Array(count3).fill(NaN);
  var fieldAt = (array, field, i) => array && i < array.length ? array[i] : COUNTS.has(field) ? 0 : NaN;
  function encodeRecord(record2, previous, fields, keyOf2) {
    const count3 = Math.max(0, ...fields.map((f) => record2[f]?.length || 0));
    const key2 = !previous || keyOf2(previous) !== keyOf2(record2);
    const idx = [];
    for (let i = 0; i < count3; i++) {
      const changed2 = key2 ? fields.some((f) => hasValue(fieldAt(record2[f], f, i))) : fields.some((f) => !same(fieldAt(record2[f], f, i), fieldAt(previous[f], f, i)));
      if (changed2) idx.push(i);
    }
    const out = { count: count3, key: key2, idx: count3 < 65536 ? Uint16Array.from(idx) : Uint32Array.from(idx) };
    for (const [k, v] of Object.entries(record2)) if (!fields.includes(k)) out[k] = v;
    for (const f of fields) {
      const values = emptyOf(f, idx.length);
      idx.forEach((i, j2) => values[j2] = fieldAt(record2[f], f, i));
      out[f] = values;
    }
    return out;
  }
  function decodeRecords(stored2, fields) {
    const out = [];
    let previous = null;
    for (const s2 of stored2) {
      if (!s2.idx) {
        out.push(s2);
        previous = s2;
        continue;
      }
      const full = {};
      for (const [k, v] of Object.entries(s2)) if (!fields.includes(k) && k !== "idx" && k !== "count" && k !== "key") full[k] = v;
      for (const f of fields) {
        const values = emptyOf(f, s2.count);
        if (!s2.key && previous) for (let i = 0; i < s2.count; i++) values[i] = fieldAt(previous[f], f, i);
        if (s2[f]) s2.idx.forEach((i, j2) => values[i] = s2[f][j2]);
        full[f] = values;
      }
      out.push(full);
      previous = full;
    }
    return out;
  }
  var dayOf = (r) => Math.floor(r.hour / 24);
  var weekOf = (d) => Math.floor(d.day / 7);
  function encodeChanged(list, dirty, keyField, fields, keyOf2) {
    const out = [];
    list.forEach((r, i) => {
      if (dirty.has(r[keyField]) || i > 0 && dirty.has(list[i - 1][keyField])) out.push(encodeRecord(r, list[i - 1] || null, fields, keyOf2));
    });
    return out;
  }
  function snapshotRecord(marketData, hour, items, index) {
    const entries = [];
    for (const [hrid, levels] of Object.entries(marketData)) {
      for (const [level, entry] of Object.entries(levels || {})) {
        if (!(entry?.a > 0) && !(entry?.b > 0) && !(entry?.v > 0) && level !== "0") continue;
        const key2 = historyKey(hrid, Number(level));
        if (!index.has(key2)) {
          index.set(key2, items.length);
          items.push(key2);
        }
        entries.push([index.get(key2), entry]);
      }
    }
    const count3 = items.length;
    const record2 = { hour, a: new Float32Array(count3).fill(NaN), b: new Float32Array(count3).fill(NaN), p: new Float32Array(count3).fill(NaN), v: new Float32Array(count3).fill(NaN), sold: true };
    for (const [i, entry] of entries) {
      if (entry?.a > 0) record2.a[i] = entry.a;
      if (entry?.b > 0) record2.b[i] = entry.b;
      if (entry?.p > 0) record2.p[i] = entry.p;
      if (entry?.v > 0) record2.v[i] = entry.v;
    }
    return record2;
  }
  function itemMap(keys, items, index) {
    return keys.map((key2) => {
      if (!index.has(key2)) {
        index.set(key2, items.length);
        items.push(key2);
      }
      return index.get(key2);
    });
  }
  function remapRecord(record2, map, count3, fields) {
    const out = {};
    for (const [k, v] of Object.entries(record2)) if (!fields.includes(k)) out[k] = v;
    for (const f of fields) {
      const values = emptyOf(f, count3);
      const from = record2[f];
      if (from) for (let j2 = 0; j2 < from.length && j2 < map.length; j2++) values[map[j2]] = from[j2];
      out[f] = values;
    }
    return out;
  }
  function median(pairs) {
    const list = pairs.filter(([v, w]) => Number.isFinite(v) && w > 0).sort((x, y) => x[0] - y[0]);
    const total = list.reduce((sum, [, w]) => sum + w, 0);
    if (!total) return null;
    let seen = 0;
    for (let i = 0; i < list.length; i++) {
      seen += list[i][1];
      if (seen * 2 > total) return list[i][0];
      if (seen * 2 === total) return (list[i][0] + list[i + 1][0]) / 2;
    }
    return list[list.length - 1][0];
  }
  function quantile(pairs, q) {
    const list = pairs.filter(([v, w]) => Number.isFinite(v) && w > 0).sort((x, y) => x[0] - y[0]);
    const total = list.reduce((sum, [, w]) => sum + w, 0);
    if (!total) return null;
    let seen = 0;
    for (const [v, w] of list) {
      seen += w;
      if (seen >= q * total) return v;
    }
    return list[list.length - 1][0];
  }
  function dayStats(values) {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return [NaN, NaN, NaN, 0];
    return [median(finite.map((v) => [v, 1])), Math.min(...finite), Math.max(...finite), finite.length];
  }
  function rollUpDays(hourlyRecords, itemCount) {
    const byDay = /* @__PURE__ */ new Map();
    for (const record2 of hourlyRecords) {
      const day = Math.floor(record2.hour / 24);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(record2);
    }
    return [...byDay].map(([day, records]) => {
      const out = { day, a: new Float32Array(itemCount), b: new Float32Array(itemCount), aLow: new Float32Array(itemCount), aHigh: new Float32Array(itemCount), bLow: new Float32Array(itemCount), bHigh: new Float32Array(itemCount), n: new Uint8Array(itemCount), p: new Float32Array(itemCount), v: new Float32Array(itemCount), vn: new Uint8Array(itemCount) };
      const sold = records.filter((r) => r.sold);
      for (let i = 0; i < itemCount; i++) {
        out.p[i] = dayStats(sold.map((r) => at(r.p, i)))[0];
        out.v[i] = sold.length ? sold.reduce((sum, r) => sum + (Number.isFinite(at(r.v, i)) ? at(r.v, i) : 0), 0) / sold.length : NaN;
        out.vn[i] = sold.length;
        const [aMed, aLow, aHigh, an] = dayStats(records.map((r) => i < r.a.length ? r.a[i] : NaN));
        const [bMed, bLow, bHigh, bn] = dayStats(records.map((r) => i < r.b.length ? r.b[i] : NaN));
        out.a[i] = aMed;
        out.aLow[i] = aLow;
        out.aHigh[i] = aHigh;
        out.b[i] = bMed;
        out.bLow[i] = bLow;
        out.bHigh[i] = bHigh;
        out.n[i] = Math.max(an, bn);
      }
      return out;
    });
  }
  var at = (array, i) => array && i < array.length ? array[i] : NaN;
  function summarize(i, hours, days, nowHour) {
    const side = (key2) => {
      const week = [];
      const before = [];
      const month = [];
      for (const r of hours) {
        const v = at(r[key2], i);
        if (!Number.isFinite(v)) continue;
        const age = nowHour - r.hour;
        if (age < 7 * 24) week.push([v, 1]);
        else if (age < 14 * 24) before.push([v, 1]);
        if (age < 30 * 24) month.push([v, 1]);
      }
      for (const d of days) {
        const v = at(d[key2], i);
        if (Number.isFinite(v) && nowHour - (d.day * 24 + 12) < 30 * 24) month.push([v, at(d.n, i) || 1]);
      }
      const week7 = median(week);
      const previous = before.length >= MIN_HOURS ? median(before) : null;
      const swing = week7 ? median(week.map(([v, w]) => [Math.abs(v / week7 - 1), w])) : null;
      return { med7: week7, med30: median(month), trend: week7 && previous ? week7 / previous - 1 : null, swing, q25: quantile(week, 0.25), q75: quantile(week, 0.75) };
    };
    let first = Infinity;
    let hours7 = 0;
    for (const r of hours) {
      if (!Number.isFinite(at(r.a, i)) && !Number.isFinite(at(r.b, i))) continue;
      first = Math.min(first, r.hour);
      if (nowHour - r.hour < 7 * 24) hours7++;
    }
    for (const d of days) if (at(d.n, i)) first = Math.min(first, d.day * 24);
    const spanDays = Number.isFinite(first) ? (nowHour - first) / 24 : 0;
    return { a: side("a"), b: side("b"), hours7, spanDays, enough: hours7 >= MIN_HOURS && spanDays >= MIN_DAYS, liquidity: liquidity(i, hours, nowHour) };
  }
  function liquidity(i, hours, nowHour) {
    let observed = 0;
    let both = 0;
    let pairs = 0;
    let moves = 0;
    let lastAsk = NaN;
    const spreads = [];
    for (const r of hours) {
      if (nowHour - r.hour >= 7 * 24) continue;
      const a = at(r.a, i);
      const b = at(r.b, i);
      if (!Number.isFinite(a) && !Number.isFinite(b)) continue;
      observed++;
      if (Number.isFinite(a) && Number.isFinite(b)) {
        both++;
        spreads.push([Math.max(0, a - b) / a, 1]);
      }
      if (Number.isFinite(a)) {
        if (Number.isFinite(lastAsk)) {
          pairs++;
          if (a !== lastAsk) moves++;
        }
        lastAsk = a;
      }
    }
    return { hours: observed, both: observed ? both / observed : 0, spread: median(spreads), activity: pairs ? moves / pairs : 0, sold: soldPerDay(i, hours, nowHour) };
  }
  var SPIKE = 3;
  function soldPerDay(i, hours, nowHour) {
    const counts = [];
    const prices2 = [];
    for (const r of hours) {
      if (!r.sold || nowHour - r.hour >= 7 * 24) continue;
      const v = at(r.v, i);
      counts.push(Number.isFinite(v) ? v : 0);
      if (Number.isFinite(at(r.p, i))) prices2.push([at(r.p, i), Number.isFinite(v) ? v : 1]);
    }
    const counted2 = counts.length;
    const cap3 = SPIKE * (median(counts.filter((v) => v > 0).map((v) => [v, 1])) ?? 0);
    const sum = (list) => list.reduce((total, v) => total + v, 0);
    const perDay2 = (list) => counted2 ? sum(list) / counted2 * 24 : null;
    return { hours: counted2, perDay: perDay2(counts.map((v) => Math.min(v, cap3))), rawPerDay: perDay2(counts), selling: counted2 ? counts.filter((v) => v > 0).length / counted2 : null, price: median(prices2), enough: counted2 >= MIN_HOURS };
  }
  function historyCsv(items, hours, days, exportedAt = /* @__PURE__ */ new Date(), { hourlySold = false } = {}) {
    const num2 = (v) => Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "";
    const hourText = (hour) => new Date(hour * HOUR_MS).toISOString().slice(0, 13);
    const dayText2 = (day) => new Date(day * 24 * HOUR_MS).toISOString().slice(0, 10);
    const id = (hrid) => hrid.replace(/^\/items\//, "");
    const sold = (d, i) => at(d.vn, i) ? `${num2(at(d.v, i) || 0)},${at(d.vn, i)},${num2(at(d.p, i))}` : ",,";
    const lines = [
      `# MWI Advisor price history, exported ${exportedAt.toISOString().slice(0, 16)}Z; saved while the game was open on this device, and around the clock by your Pi if it is linked.`,
      "# ask = lowest sell order, bid = best buy order, in coins; empty = none. Times are UTC.",
      `# section hour: an item's row appears when its ask or bid changed since its previous row (in between it stayed the same).`,
      `# Hours with data: ${hours.map((r) => hourText(r.hour)).join(",")}`,
      `# section day (older than ${HOURLY_DAYS} days): the day's median ask and bid, their low and high, and how many hours had data.`,
      "# sold_mean = how many were traded per hour (the market file's v, an hour's count), the mean over the sold_hours hours of the day that",
      "#   had the numbers (0 = none traded; \xD7 24 for a day); sold_price = the median of the hours' average trade price (p).",
      hourlySold ? "#   On day rows; in section sold one row per hour that had the numbers and an item that traded (sold_mean = that hour's count, sold_hours = 1)." : "#   On day rows, and in section sold for the hourly days (only items that traded).",
      "section,time,item,ask,bid,ask_low,ask_high,bid_low,bid_high,hours,sold_mean,sold_hours,sold_price"
    ];
    const previous = /* @__PURE__ */ new Map();
    for (const r of hours) {
      items.forEach((hrid, i) => {
        const pair = num2(at(r.a, i)) + "," + num2(at(r.b, i));
        if (previous.get(i) === pair || !previous.has(i) && pair === ",") return;
        previous.set(i, pair);
        lines.push(`hour,${hourText(r.hour)},${id(hrid)},${pair}`);
      });
    }
    if (hourlySold) {
      for (const r of hours.filter((r2) => r2.sold)) {
        items.forEach((hrid, i) => {
          if (at(r.v, i) > 0) lines.push(`sold,${hourText(r.hour)},${id(hrid)},,,,,,,,${num2(at(r.v, i))},1,${num2(at(r.p, i))}`);
        });
      }
    }
    for (const d of hourlySold ? [] : rollUpDays(hours.filter((r) => r.sold), items.length)) {
      items.forEach((hrid, i) => {
        if (at(d.v, i) > 0) lines.push(`sold,${dayText2(d.day)},${id(hrid)},,,,,,,,${sold(d, i)}`);
      });
    }
    for (const d of days) {
      items.forEach((hrid, i) => {
        if (!at(d.n, i)) return;
        lines.push(`day,${dayText2(d.day)},${id(hrid)},${[d.a, d.b, d.aLow, d.aHigh, d.bLow, d.bHigh].map((list) => num2(at(list, i))).join(",")},${at(d.n, i)},${sold(d, i)}`);
      });
    }
    return { csv: lines.join("\n") + "\n", items: items.length, hours: hours.length, days: days.length };
  }
  function versusUsual(price, usual) {
    if (!(price > 0) || !(usual > 0)) return null;
    const diff = price / usual - 1;
    return { diff, label: diff > USUAL_BAND ? "above" : diff < -USUAL_BAND ? "below" : "near" };
  }
  var trendArrow = (trend) => trend === null ? "" : trend > TREND_BAND ? "\u2191" : trend < -TREND_BAND ? "\u2193" : "\u2192";
  var store2 = {
    db: null,
    ready: null,
    items: [],
    index: /* @__PURE__ */ new Map(),
    hours: [],
    // hourly records, oldest first
    days: [],
    // daily records of the last 30 days, oldest first
    allDays: null,
    // every daily record, loaded on demand
    last: null,
    pi: null,
    // what came from the Pi: { epoch, items: its item order, hour, day: the newest received }
    queue: Promise.resolve(),
    // changes are written one at a time
    version: 0,
    // bumps on every new snapshot
    summaries: /* @__PURE__ */ new Map()
  };
  var request = (req) => new Promise((resolve2, reject) => {
    req.onsuccess = () => resolve2(req.result);
    req.onerror = () => reject(req.error);
  });
  var done = (tx) => new Promise((resolve2, reject) => {
    tx.oncomplete = resolve2;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  function openDb() {
    return new Promise((resolve2, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore(HOURLY, { keyPath: "hour" });
        db.createObjectStore(DAILY, { keyPath: "day" });
        db.createObjectStore(META);
      };
      req.onsuccess = () => resolve2(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function loadHistory() {
    store2.ready || (store2.ready = (async () => {
      store2.db = await openDb();
      const tx = store2.db.transaction([HOURLY, META], "readonly");
      const [items, last, pi, hours] = await Promise.all(["items", "last", "pi"].map((key2) => request(tx.objectStore(META).get(key2))).concat(request(tx.objectStore(HOURLY).getAll())));
      const newest = hours.length ? hours[hours.length - 1].hour : 0;
      const fromDay = Math.floor((Math.floor(newest / 24) - 31) / 7) * 7;
      store2.days = decodeRecords(await request(store2.db.transaction(DAILY, "readonly").objectStore(DAILY).getAll(IDBKeyRange.lowerBound(fromDay))), DAILY_FIELDS);
      store2.items = items || [];
      store2.items.forEach((hrid, i) => store2.index.set(hrid, i));
      store2.last = last ?? null;
      store2.pi = pi ?? null;
      store2.hours = decodeRecords(hours, HOURLY_FIELDS);
      store2.version++;
    })());
    return store2.ready;
  }
  async function recordSnapshot(marketData, timestamp) {
    await loadHistory();
    return serially(async () => {
      if (timestamp && timestamp === store2.last) return false;
      const stamped = Math.abs(timestamp * 1e3 - Date.now()) < 3 * HOUR_MS;
      const hour = Math.floor((stamped ? timestamp * 1e3 : Date.now()) / HOUR_MS);
      if (store2.pi?.hour >= hour) return false;
      const record2 = snapshotRecord(marketData, hour, store2.items, store2.index);
      await commit([record2], [], { last: timestamp ?? null });
      store2.last = timestamp ?? null;
      return true;
    });
  }
  async function mergeFromPi(wire, unpack) {
    await loadHistory();
    return serially(async () => {
      let pi = store2.pi && store2.pi.epoch === wire.epoch ? { ...store2.pi, items: [...store2.pi.items] } : { epoch: wire.epoch, items: [], hour: null, day: null };
      if (wire.itemsFrom !== pi.items.length) throw new Error("the Pi's item list is out of step; it is read again next time");
      if (!wire.items.length && !wire.hours.length && !wire.days.length && store2.pi) return { hours: 0, days: 0 };
      pi.items.push(...wire.items);
      const map = itemMap(pi.items, store2.items, store2.index);
      const count3 = store2.items.length;
      const hours = decodeRecords(wire.hours.map(unpack), HOURLY_FIELDS).map((r) => remapRecord(r, map, count3, HOURLY_FIELDS));
      const days = decodeRecords(wire.days.map(unpack), DAILY_FIELDS).map((d) => remapRecord(d, map, count3, DAILY_FIELDS));
      for (const r of hours) pi.hour = Math.max(pi.hour ?? -Infinity, r.hour);
      for (const d of days) pi.day = Math.max(pi.day ?? -Infinity, d.day);
      await commit(hours, days, { pi });
      store2.pi = pi;
      return { hours: hours.length, days: days.length };
    }).catch((error) => {
      if (/out of step/.test(error.message)) store2.pi = null;
      throw error;
    });
  }
  var piReceived = () => store2.pi && { epoch: store2.pi.epoch, items: store2.pi.items.length, hour: store2.pi.hour, day: store2.pi.day };
  var serially = (job) => store2.queue = store2.queue.then(job, job);
  async function commit(newHours, newDays, meta) {
    const count3 = store2.items.length;
    const dayKeys = new Set(newDays.map((d) => d.day));
    const hourKeys = new Set(newHours.map((r) => r.hour));
    const removed = store2.hours.filter((r) => hourKeys.has(r.hour) || dayKeys.has(dayOf(r)));
    store2.hours = [...store2.hours.filter((r) => !removed.includes(r)), ...newHours].sort((x, y) => x.hour - y.hour);
    const gone = removed.filter((r) => !hourKeys.has(r.hour)).map((r) => r.hour);
    const dirtyHours = new Set(hourKeys);
    for (const hour of gone) {
      const next = store2.hours.find((r) => r.hour > hour);
      if (next) dirtyHours.add(next.hour);
    }
    const newest = store2.hours.length ? store2.hours[store2.hours.length - 1].hour : null;
    const cutoffDay = newest === null ? -Infinity : Math.floor((newest - HOURLY_DAYS * 24) / 24);
    const old = store2.hours.filter((r) => dayOf(r) < cutoffDay);
    store2.hours = store2.hours.filter((r) => dayOf(r) >= cutoffDay);
    const summed = new Set([...store2.days, ...store2.allDays || []].map((d) => d.day));
    const rollable = old.filter((r) => !summed.has(dayOf(r)));
    const changedDays = [...newDays, ...rollable.length ? rollUpDays(rollable, count3) : []];
    const changedDayKeys = new Set(changedDays.map((d) => d.day));
    const hourWrites = encodeChanged(store2.hours, dirtyHours, "hour", HOURLY_FIELDS, dayOf);
    const windowStart = store2.days.length ? store2.days[0].day : Infinity;
    if (changedDays.some((d) => d.day < windowStart)) await loadAllDays();
    const replaceDays = (list) => [...list.filter((d) => !changedDayKeys.has(d.day)), ...changedDays].sort((x, y) => x.day - y.day);
    const dayList = changedDays.some((d) => d.day < windowStart) ? store2.allDays = replaceDays(store2.allDays) : store2.days = replaceDays(store2.days);
    if (dayList === store2.days && store2.allDays) store2.allDays = replaceDays(store2.allDays);
    const dayWrites = encodeChanged(dayList, changedDayKeys, "day", DAILY_FIELDS, weekOf);
    const newestDay = newest === null ? Math.max(-Infinity, ...dayList.map((d) => d.day)) : Math.floor(newest / 24);
    store2.days = (store2.allDays || dayList).filter((d) => d.day >= newestDay - 31);
    const tx = store2.db.transaction([HOURLY, DAILY, META], "readwrite");
    for (const hour of gone) tx.objectStore(HOURLY).delete(hour);
    for (const r of old) tx.objectStore(HOURLY).delete(r.hour);
    for (const w of hourWrites) tx.objectStore(HOURLY).put(w);
    for (const d of dayWrites) tx.objectStore(DAILY).put(d);
    if (Number.isFinite(newestDay)) tx.objectStore(DAILY).delete(IDBKeyRange.upperBound(Math.floor((newestDay - DAILY_DAYS) / 7) * 7, true));
    tx.objectStore(META).put(store2.items, "items");
    for (const [key2, value] of Object.entries(meta)) tx.objectStore(META).put(value, key2);
    await done(tx);
    store2.version++;
    store2.summaries.clear();
  }
  var historyVersion = () => store2.version;
  function priceSummary(itemHrid, level = 0) {
    if (!store2.hours.length) return null;
    const key2 = historyKey(itemHrid, level);
    const i = store2.index.get(key2);
    if (i === void 0) return null;
    if (!store2.summaries.has(key2)) {
      store2.summaries.set(key2, summarize(i, store2.hours, store2.days, store2.hours[store2.hours.length - 1].hour));
    }
    return store2.summaries.get(key2);
  }
  function volumeBins(points, bins, t0, t1) {
    const span = Math.max(1, t1 - t0);
    const sum = new Array(bins).fill(0);
    const hours = new Array(bins).fill(0);
    for (const p2 of points) {
      if (!Number.isFinite(p2.v)) continue;
      const k = Math.min(bins - 1, Math.max(0, Math.floor((p2.t - t0) / span * bins)));
      sum[k] += p2.v * (p2.w || 1);
      hours[k] += p2.w || 1;
    }
    return sum.map((s2, k) => hours[k] ? s2 / hours[k] * 24 : null);
  }
  function recentHours(itemHrid, level = 0, days = 7) {
    const i = store2.index.get(historyKey(itemHrid, level));
    if (i === void 0 || !store2.hours.length) return [];
    const newest = store2.hours[store2.hours.length - 1].hour;
    return store2.hours.filter((r) => newest - r.hour < days * 24).map((r) => ({ hour: r.hour, a: at(r.a, i), b: at(r.b, i), p: at(r.p, i), v: at(r.v, i), sold: !!r.sold }));
  }
  async function loadAllDays() {
    await loadHistory();
    if (!store2.allDays) {
      const tx = store2.db.transaction(DAILY, "readonly");
      store2.allDays = decodeRecords(await request(tx.objectStore(DAILY).getAll()), DAILY_FIELDS);
    }
    return store2.allDays;
  }
  async function priceSeries(itemHrid, range, level = 0) {
    await loadHistory();
    const i = store2.index.get(historyKey(itemHrid, level));
    if (i === void 0 || !store2.hours.length) return [];
    const newest = store2.hours[store2.hours.length - 1].hour;
    const days = range > 31 ? await loadAllDays() : store2.days;
    const points = [];
    for (const d of days) {
      const t4 = d.day * 24 + 12;
      if (newest - t4 <= range * 24) points.push({ t: t4, a: at(d.a, i), b: at(d.b, i), v: d.vn && at(d.vn, i) ? at(d.v, i) : NaN, w: 24 });
    }
    for (const r of store2.hours) {
      if (newest - r.hour > range * 24) continue;
      const v = at(r.v, i);
      points.push({ t: r.hour, a: at(r.a, i), b: at(r.b, i), v: r.sold ? Number.isFinite(v) ? v : 0 : NaN, w: 1 });
    }
    return points.filter((p2) => Number.isFinite(p2.a) || Number.isFinite(p2.b)).sort((x, y) => x.t - y.t);
  }
  async function longMedians(itemHrid, level = 0) {
    const i = store2.index.get(historyKey(itemHrid, level));
    if (i === void 0) return null;
    const days = await loadAllDays();
    const newestDay = days.length ? days[days.length - 1].day : 0;
    const pick2 = (key2, span) => median(days.filter((d) => newestDay - d.day < span).map((d) => [at(d[key2], i), at(d.n, i) || 1]));
    return { a90: pick2("a", 90), b90: pick2("b", 90), a365: pick2("a", 365), b365: pick2("b", 365), days: days.filter((d) => at(d.n, i)).length };
  }
  async function exportHistory() {
    await loadHistory();
    const days = await loadAllDays();
    return historyCsv(store2.items, store2.hours, days);
  }

  // src/skilling-ui.js
  var SHORT_LIST = 25;
  var RATING = { stable: "\u{1F7E2} stable market", ok: "\u{1F7E1} ok market", thin: "\u{1F534} thin market" };
  var view = { upgradesKey: "", upgrades: null, showAll: false, open: /* @__PURE__ */ new Set() };
  var dec = (n5, d = 1) => n5.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  var pct = (fraction) => `${fraction >= 0 ? "+" : ""}${dec(fraction * 100, 1)}%`;
  var count = (n5) => n5 >= 100 ? dec(n5, 0) : n5 >= 1 ? dec(n5, 2) : n5.toPrecision(2);
  var coins = (n5) => (n5 < 0 ? "\u2212" : "") + shortCoins(Math.abs(n5));
  var skillLabel = (skill) => skill.charAt(0).toUpperCase() + skill.slice(1);
  var skillOf = (entry) => entry.skill.split("/").pop();
  var names = (teas) => teas.map(itemName).join(", ");
  var planMode = (s2) => PLAN_MODES[s2.skillingMode] ? s2.skillingMode : "away";
  var goldShare = (s2) => s2.skillingGold === void 0 || s2.skillingGold === "" ? 100 : Number(s2.skillingGold);
  var focusLabel = (gold) => gold === 0 ? "XP only" : gold === 100 ? "Gold only" : `${100 - gold}% XP \xB7 ${gold}% gold`;
  function hoursText(hours) {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours < 48) return `${dec(hours, hours < 10 && Math.round(hours * 10) % 10 ? 1 : 0)} h`;
    return `${dec(hours / 24, hours < 240 ? 1 : 0)} days`;
  }
  function skillingSettingsHtml(s2) {
    const option = (value, label3, current) => `<option value="${value}" ${current === value ? "selected" : ""}>${label3}</option>`;
    return `<div class="mwia-settings">
      <label>Skill <select data-setting="skillingSkill">${option("all", "All skills", s2.skillingSkill)}${SKILLING_SKILLS.map((k) => option(k, skillLabel(k), s2.skillingSkill)).join("")}<optgroup label="Levelling (costs gold)">${LEVELING_SKILLS.map((k) => option(k, skillLabel(k), s2.skillingSkill)).join("")}</optgroup></select></label>
      <label title="Products are listed at the cheapest ask (you wait for a buyer) or sold instantly to the best bid. The 4% market tax is taken off either way.">Sell at <select data-setting="skillingSellAt">${option("ask", "Ask (list it)", s2.skillingSellAt)}${option("bid", "Bid (sell now)", s2.skillingSellAt)}</select></label>
      <label title="Rank with the teas you have in the skill's drink slots now, or with the setup that earns the most.">Teas <select data-setting="skillingTeas">${option("current", "My current teas", s2.skillingTeas)}${option("best", "Best teas", s2.skillingTeas)}</select></label>
      <label title="Away: a careful job of about ${hoursText(PLAN_MODES.away.hours)}, little of your coins unless the market is stable, thin margins left out. Medium: ${hoursText(PLAN_MODES.medium.hours)} jobs while you look in now and then. Active: ${hoursText(PLAN_MODES.active.hours)} jobs while you play, the most of your coins. Medium and Active show thin margins.">Plan <select data-setting="skillingMode">${[["away", "Away"], ["medium", "Medium"], ["active", "Active"]].map(([mode, name]) => option(mode, `${name} (${hoursText(PLAN_MODES[mode].hours)})`, planMode(s2))).join("")}</select></label>
      <label class="mwia-focus" title="Rank by gold per day, XP per day, or a mix. Each counts as a share of the most any action in the list gives. The best teas follow the same focus.">
        Focus: <span class="mwia-focus-text">${focusLabel(goldShare(s2))}</span>
        <span class="mwia-focus-row">XP <input type="range" min="0" max="100" step="10" value="${goldShare(s2)}" data-setting="skillingGold"> Gold</span></label>
      <label title="Count the XP as the levels it gives the skill from where it is now: a low skill's levels are cheap, so this is the fastest way up in total level. Counted over a day of training.">
        Total level <span class="mwia-focus-row"><input type="checkbox" data-setting="countLevels" ${s2.countLevels ? "checked" : ""}> Count levels, not XP</span></label>
    </div>`;
  }
  var rankings = /* @__PURE__ */ new Map();
  var KEPT_RANKINGS = 4;
  function ranking(settings2, fixed = null) {
    const key2 = [state.updatedAt, pricesStamp(), settings2.skillingSkill, settings2.skillingSellAt, settings2.skillingTeas, planMode(settings2), goldShare(settings2), !!settings2.countLevels, historyVersion(), JSON.stringify(fixed)].join("|");
    if (!rankings.has(key2)) {
      rankings.set(key2, computeRanking(settings2, fixed));
      while (rankings.size > KEPT_RANKINGS) rankings.delete(rankings.keys().next().value);
    }
    return rankings.get(key2);
  }
  function skillingAdvice(actionHrid, settings2, job = null) {
    const skill = actionHrid.split("/")[2];
    if (LEVELING_SKILLS.includes(skill)) {
      if (!job?.itemHrid) return null;
      const level = skill === "alchemy" && actionHrid.endsWith("/decompose") ? Number(job.level) || 0 : 0;
      const hrid = `${actionHrid}#${job.itemHrid}${level > 0 ? `#+${level}` : ""}`;
      const fixed = { hrid, target: skill === "enhancing" ? Number(job.target) || null : null };
      return ranking({ ...settings2, skillingSkill: skill }, fixed).available.find((entry) => entry.hrid === hrid) || null;
    }
    if (!SKILLING_SKILLS.includes(skill)) return null;
    const result = ranking({ ...settings2, skillingSkill: skill });
    return result.available.find((entry) => entry.hrid === actionHrid) || null;
  }
  var adviceName = (entry) => entry.action.name + (entry.target ? ` \u2192 +${entry.target}` : "");
  var itemOfHash = (hash2) => String(hash2 || "").split("::")[2] || null;
  var levelOfHash = (hash2) => Number(String(hash2 || "").split("::")[3]) || 0;
  function computeRanking(settings2, fixed = null) {
    const data = getClientData();
    {
      const who = skillingCharacter(state.character, state.items, data);
      const market = skillingMarket(settings2.skillingSellAt);
      const plan = {
        stock: (action) => heldStock(state.character, state.items, action.outputItems?.[0]?.itemHrid),
        book: (action) => state.orderBooks.get(action.outputItems?.[0]?.itemHrid) || null,
        ...PLAN_MODES[planMode(settings2)],
        coins: have("/items/coin"),
        have,
        sellAt: settings2.skillingSellAt,
        price: (action) => priceNow(action.outputItems?.[0]?.itemHrid, settings2.skillingSellAt),
        liquidity: (action) => action.outputItems?.[0]?.itemHrid === COIN4 ? COIN_MARKET : liquidityRating(action.outputItems?.[0]?.itemHrid ? priceSummary(action.outputItems[0].itemHrid) : null),
        inputMarket: (hrid, level = 0) => ({ liquidity: liquidityRating(priceSummary(hrid, level)), book: level ? orderBookAt(hrid, level) : state.orderBooks.get(hrid) || null })
      };
      const leveling2 = { ...levelingOptions(settings2, data), fixed };
      const result = rankSkilling(who, data, market, { skill: settings2.skillingSkill, teaMode: settings2.skillingTeas, plan, goldWeight: goldShare(settings2) / 100, countLevels: !!settings2.countLevels, leveling: leveling2 });
      for (const entry of [...result.available, ...result.upcoming]) {
        entry.warnings = [...entry.warnings, ...isEnhance(entry) ? enhanceWarnings(entry) : priceWarnings(entry), ...rollWarnings(entry)];
        if (isAlchemy(entry) && entry.suggestion) entry.suggestion.verb = ALCHEMY_KINDS[entry.action.kind].name.toLowerCase();
      }
      return result;
    }
  }
  var levelingOptions = (settings2, data) => ({
    resale: (hrid, level) => plusResale(hrid, level, settings2.skillingSellAt, data),
    owned: (hrid, level = 0) => have(hrid, level),
    plusLevels: (hrid) => [.../* @__PURE__ */ new Set([...marketListings(hrid).map((l2) => l2.enhancementLevel), ...heldLevels(hrid)])].filter((level) => level > 0).sort((a, b) => a - b),
    plusBuy: (hrid, level) => marketEntry(hrid, level)?.a > 0 ? marketEntry(hrid, level).a : null,
    plusHeld: (hrid, level) => plusResale(hrid, level, "bid", data).price
  });
  function skillingMarket(sellAt) {
    const usualAsk = (hrid) => {
      const summary2 = priceSummary(hrid);
      return summary2 && summary2.hours7 >= MIN_HOURS ? summary2.a.med7 : null;
    };
    const soldOf = (hrid) => {
      const sold = priceSummary(hrid)?.liquidity?.sold;
      return sold?.enough ? sold.perDay : null;
    };
    return marketPricer((hrid) => marketEntry(hrid), getClientData(), sellAt, usualAsk, soldOf);
  }
  var COIN4 = "/items/coin";
  var COIN_MARKET = { rating: "stable", known: true, coin: true };
  var isEnhance = (entry) => entry.action.function === ENHANCE_FUNCTION;
  var isAlchemy = (entry) => entry.action.function === ALCHEMY_FUNCTION;
  function plusResale(itemHrid, level, sellAt, data) {
    const entry = marketEntry(itemHrid, level);
    const summary2 = priceSummary(itemHrid, level);
    const usual = summary2?.hours7 >= MIN_HOURS ? summary2 : null;
    const ask = entry?.a > 0 ? entry.a : null;
    const bid = entry?.b > 0 ? entry.b : null;
    const usualAsk = usual?.a.med7 > 0 ? usual.a.med7 : null;
    const usualBid = usual?.b.med7 > 0 ? usual.b.med7 : null;
    const soldNow = summary2?.liquidity?.sold;
    const sold = soldNow?.enough ? soldNow.perDay : null;
    const lower = marketBids(itemHrid).filter((b) => b.enhancementLevel < level).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
    const vendor = data.itemDetailMap[itemHrid]?.sellPrice || 0;
    const floor = lower ? lower.bid * (1 - MARKET_TAX) : vendor;
    const base = { ask, bid, usualAsk, usualBid, history: !!usual, sold, floor, floorLevel: lower ? lower.enhancementLevel : null };
    const out = (price, source, from = level) => ({ ...base, price: price * (1 - MARKET_TAX), source, level: from });
    const backed = bid || usualAsk || sold > 0;
    if (sellAt === "ask" && backed && (ask || usualAsk)) {
      const ceiling = usualAsk || (bid ? WIDE_SPREAD * bid : soldNow?.price || Infinity);
      return out(Math.min(ask || usualAsk, ceiling), ask ? ask > ceiling ? usualAsk ? "usual" : "spread" : "ask" : "usual");
    }
    if (bid || usualBid) return out(bid || usualBid, bid ? "bid" : "usualbid");
    const unbacked = sellAt === "ask" && ask ? ask : null;
    if (lower) return { ...out(lower.bid, "lower", lower.enhancementLevel), unbacked };
    return { ...base, price: vendor, source: "vendor", level: null, unbacked };
  }
  var FEW_ROLLS = 10;
  function rollWarnings(entry) {
    const plus = isAlchemy(entry) ? entry.action.enhancementLevel || 0 : isEnhance(entry) && entry.finish ? entry.target : 0;
    if (!plus) return [];
    const n5 = isAlchemy(entry) ? entry.suggestion?.count ?? have(entry.action.itemHrid, plus) : Math.round(entry.itemsPerHour * (entry.budget?.hours ?? PLAN_MODES.away.hours));
    if (n5 >= FEW_ROLLS) return [];
    const successRate = isAlchemy(entry) ? entry.successRate : entry.finish.entry.successRate;
    return [{ kind: "oneroll", itemHrid: entry.action.itemHrid, level: plus, successRate, count: n5 }];
  }
  function enhanceWarnings(entry) {
    const sell = entry.outputs[0]?.sell;
    if (!sell || sell.source === "decompose") return [];
    if (sell.source === "lower" || sell.source === "vendor") return [{ kind: "plusfloor", itemHrid: entry.action.itemHrid, target: entry.target, from: sell.level, unbacked: sell.unbacked }];
    if (!sell.history) return [{ kind: "plusnohistory", itemHrid: entry.action.itemHrid, target: entry.target }];
    return [];
  }
  function priceNow(itemHrid, sellAt) {
    const summary2 = itemHrid ? priceSummary(itemHrid) : null;
    if (!summary2?.enough) return null;
    const side = sellAt === "bid" ? "b" : "a";
    const now2 = marketEntry(itemHrid)?.[side];
    const usual = summary2[side].med7;
    return { swing: summary2[side].swing, diff: now2 > 0 && usual > 0 ? now2 / usual - 1 : null };
  }
  function priceWarnings(entry) {
    const warnings = [];
    const main = entry.outputs.filter((o2) => o2.kind === "product").sort((a, b) => b.value - a.value)[0];
    if (main && (main.sell.source === "ask" || main.sell.source === "bid")) {
      const summary2 = priceSummary(main.itemHrid);
      const side = main.sell.source === "ask" ? "a" : "b";
      const versus = summary2?.enough ? versusUsual(main.sell[main.sell.source], summary2[side].med7) : null;
      if (versus && versus.label !== "near") warnings.push({ kind: versus.label === "above" ? "pricehigh" : "pricelow", itemHrid: main.itemHrid, diff: versus.diff, usual: summary2[side].med7 });
      const swing = summary2?.enough ? summary2[side].swing : null;
      if (swing > CALM_SWING && entry.margin > 0 && entry.margin < swing) warnings.push({ kind: "swing", itemHrid: main.itemHrid, swing, margin: entry.margin });
    }
    for (const input of entry.inputs) {
      const summary2 = priceSummary(input.itemHrid);
      const versus = summary2?.enough ? versusUsual(input.price, summary2.a.med7) : null;
      if (versus?.label === "above") warnings.push({ kind: "inputhigh", itemHrid: input.itemHrid, diff: versus.diff, usual: summary2.a.med7 });
    }
    return warnings;
  }
  function rememberToggle(event) {
    const key2 = event.target.dataset?.open;
    if (!key2) return;
    if (event.target.open) view.open.add(key2);
    else view.open.delete(key2);
  }
  function toggleShowAll() {
    view.showAll = !view.showAll;
  }
  function renderSkilling(settings2) {
    const { available, upcoming } = ranking(settings2);
    setBuyLimits(
      available.filter((e2) => e2.valid && e2.suggestion?.inputs?.length).map((e2) => ({ hrid: e2.hrid, name: e2.action.name, inputs: e2.suggestion.inputs.map((i) => ({ itemHrid: i.itemHrid, limitPrice: i.limitPrice, margin: e2.suggestion.limitMargin })) }))
    );
    let html = skillingSettingsHtml(settings2);
    const leveling2 = LEVELING_SKILLS.includes(settings2.skillingSkill);
    if (settings2.skillingSkill === "enhancing") html += `<p class="mwia-dim">Enhance an item towards a target +level again and again: a failure drops it back to +0 \u2013 or, protected from a +level on, one level, using up the cheapest protection (a copy, a Mirror of Protection or the item's own) \u2013 reaching the target you sell it and buy a new one. One row per item, at the target that suits your <i>Focus</i>; gold per day is what it costs (\u2212) after selling. Items you have at +0 are used first, valued at what they'd sell for. Tap a row for the odds and every target.</p>`;
    else if (settings2.skillingSkill === "alchemy") html += `<p class="mwia-dim">Coinify, decompose or transmute items bought at the cheapest ask. The odds, the coins it costs, the bulk size, the catalyst that suits your <i>Focus</i>, Alchemy Essence and crates are counted. Gold per day after the ${dec(MARKET_TAX * 100, 0)}% market tax.</p>`;
    else html += `<p class="mwia-dim">Gold per day after the ${dec(MARKET_TAX * 100, 0)}% market tax, with materials and teas bought at the cheapest ask. Only what your levels allow. Tap a row to see how it was worked out.</p>`;
    if (available[0] && !available[0].buffsKnown) {
      html += `<div class="mwia-notice mwia-notice-warn">The game hasn't sent your buffs (house, equipment, community) yet, so only levels and teas are counted. Reload the page to fix it.</div>`;
    }
    const listed = available.filter((entry) => !entry.thinMargin);
    const thin = available.length - listed.length;
    const shown = view.showAll ? available : listed.slice(0, SHORT_LIST);
    const mode = PLAN_MODES[planMode(settings2)];
    html += `<section><h3>Best now</h3><p class="mwia-dim">${settings2.skillingSkill === "enhancing" ? "Ranked by your Focus: XP per day against what it costs." : `Ranked by what a ${hoursText(mode.hours)} job gives: the amount is what your coins, your stock and the market allow \u2013 no need to open the market.`}</p>`;
    if (!available.length) html += `<p class="mwia-dim">Nothing to do in this skill at your level.</p>`;
    html += `<div class="mwia-skill-list">${shown.map((entry, i) => rowHtml(entry, i === 0 && entry.valid && entry.profitPerHour > 0 && !entry.thinMargin, false, i === 0)).join("")}</div>`;
    if (available.length > shown.length || view.showAll) {
      const hidden = thin ? ` (${thin} with a thin margin)` : "";
      html += `<button class="mwia-link" data-action="skilling-all">${view.showAll ? "Show fewer" : `Show all ${available.length}${hidden}`}</button>`;
    }
    html += `</section>`;
    html += upgradesHtml(settings2);
    if (upcoming.length) {
      html += `<section><h3>Unlocks soon</h3><p class="mwia-dim">Within ${NEAR_LEVELS} levels, worked out at the level it unlocks. The time assumes you train the skill with its fastest XP action you have now.</p>
          <div class="mwia-skill-list">${upcoming.map((entry) => rowHtml(entry, false, true)).join("")}</div></section>`;
    }
    return html;
  }
  function warningText(warning) {
    const item = itemName(warning.itemHrid);
    switch (warning.kind) {
      case "noinput":
        return `Nobody sells ${names(warning.items)} right now.`;
      case "nobids":
        return `No buy orders for ${item}: it may take a while to sell.`;
      case "noasks":
        return `No one lists ${item}; priced at the best bid.`;
      case "spread":
        return `Thin market for ${item}: the cheapest ask (${coins(warning.ask)}) is ${dec(warning.ask / warning.bid, 1)}\xD7 the best bid (${coins(warning.bid)}).`;
      case "vendor":
        return `${item} isn't on the market; valued at the vendor price.`;
      case "pricehigh":
        return `${item} sells ${Math.round(warning.diff * 100)}% above its usual price (7-day median ${coins(warning.usual)}): it may drop back.`;
      case "pricelow":
        return `${item} sells ${Math.round(-warning.diff * 100)}% below its usual price (7-day median ${coins(warning.usual)}): waiting may pay.`;
      case "inputhigh":
        return `${item} costs ${Math.round(warning.diff * 100)}% more than usual (7-day median ${coins(warning.usual)}).`;
      case "swing":
        return `${item}'s price usually swings \xB1${Math.round(warning.swing * 100)}% \u2013 more than the ${dec(warning.margin * 100, 1)}% margin.`;
      case "margin":
        return `Thin margin: a ${dec(warning.margin * 100, 1)}% drop in the selling price wipes out the profit.`;
      case "unsellable":
        return `${item} can't be sold.`;
      case "plusfloor": {
        const listing = warning.unbacked ? ` The listing at ${coins(warning.unbacked)} isn't counted: nobody bids for +${warning.target} and it hasn't been seen selling.` : "";
        return (warning.from === null || warning.from === void 0 ? `Nobody buys ${item} +${warning.target} or a lower +level: valued at the shop price.` : `Nobody buys ${item} +${warning.target} right now: valued at the +${warning.from} bid \u2013 list it to sell.`) + listing;
      }
      case "plusnohistory":
        return `Under ${MIN_HOURS} hours of prices for ${item} +${warning.target} yet: its price now is used as it is.`;
      case "oneroll":
        return `Each decompose of ${item} +${warning.level} is one roll: ${dec((1 - warning.successRate) * 100, 0)}% of the time the item is lost for nothing. ${warning.count < 1 ? "Under one of them in a job" : `With ${warning.count} of them in a job`}, the result can be far from the average shown \u2013 it evens out over many.`;
      default:
        return "";
    }
  }
  function rowHtml(entry, best, upcoming = false, first = false) {
    const day = entry.goldPerDay;
    const leveling2 = isEnhance(entry) || isAlchemy(entry);
    const perXp = leveling2 && entry.coinsPerXp !== null ? ` \xB7 ${entry.coinsPerXp >= 0 ? `${dec(entry.coinsPerXp, 1)} coins/XP` : `earns ${dec(-entry.coinsPerXp, 1)}/XP`}` : "";
    const levelText2 = leveling2 ? `item level ${entry.action.levelRequirement.level}${isAlchemy(entry) ? ` \xB7 ${pct(entry.successRate).replace("+", "")} success` : ""}${entry.protect ? ` \xB7 protect from +${entry.protect.from}` : ""}${perXp}${suggestionShort(entry.suggestion)}${budgetShort(entry.budget)}` : "";
    const sub = leveling2 ? levelText2 : upcoming ? `${skillLabel(skillOf(entry))} ${entry.action.levelRequirement.level} \xB7 in ${entry.needLevels} level${entry.needLevels === 1 ? "" : "s"}${entry.hoursToUnlock !== null ? ` \xB7 ~${hoursText(entry.hoursToUnlock)}` : ""}` : `${skillLabel(skillOf(entry))} ${entry.action.levelRequirement.level}${entry.salesCap ? ` \xB7 sells ~${soldText(entry.salesCap.perDay)}/day` : ""}${suggestionShort(entry.suggestion)}`;
    const warn = entry.warnings.length ? ` <span class="mwia-warn" title="${esc(entry.warnings.map(warningText).join(" "))}">\u26A0</span>` : "";
    const teaHint = !upcoming && entry.teaMode === "current" && entry.betterTeas ? `<span class="mwia-skill-hint">\u{1F375} ${teaGain(entry.best.result, entry.current)} with other teas</span>` : "";
    const planned = (!leveling2 || isAlchemy(entry)) && !upcoming && entry.suggestion?.count && Number.isFinite(entry.plannedGoldPerDay);
    const fill = planned && entry.fill < 1 ? entry.fill : 1;
    const shownDay = planned ? entry.plannedGoldPerDay : day;
    const cut = planned && coins(shownDay) !== coins(day);
    const gold = entry.valid ? `<span class="${shownDay < 0 && !leveling2 ? "mwia-bad" : shownDay > 0 && (best || leveling2) ? "mwia-ok" : ""}">${coins(shownDay)}/day</span>` : `<span class="mwia-dim">\u2013</span>`;
    const full = cut ? `<span class="mwia-skill-full${fill < SHORT_FILL ? " mwia-warn" : ""}" title="The rate while it runs, with the materials at their lowest ask">${fill < 1 ? `full ${hoursText(entry.suggestion.plannedHours)}` : "at the lowest ask"}: ${coins(day)}/day</span>` : "";
    const chainHint = !upcoming && entry.chain && entry.chain.goldPerDay > entry.goldPerDay + 1 ? `<span class="mwia-skill-hint">\u26D3 ${coins(entry.chain.goldPerDay)}/day making the materials yourself</span>` : !upcoming && entry.decomposeCraft ? `<span class="mwia-skill-hint">\u{1F9EA} decompose them: ${esc(names(entry.decomposeCraft.reused.map((x) => x.itemHrid).filter((h3) => h3 !== COIN4)) || "materials")} back</span>` : !upcoming && entry.alchemyChain ? `<span class="mwia-skill-hint">\u26D3 then ${esc(entry.alchemyChain.further.slice(0, 2).map((f) => f.name).join(", "))}${entry.alchemyChain.further.length > 2 ? ` +${entry.alchemyChain.further.length - 2} more` : ""}</span>` : "";
    const waiting = !upcoming ? decomposeHeld(entry) : null;
    const heldHint = waiting?.held ? `<span class="mwia-skill-hint">\u{1F9EA} ${waiting.held.toLocaleString("en-US")}${waiting.level ? ` \xD7 +${waiting.level}` : ""} in your inventory to decompose</span>` : "";
    const faded = !entry.valid || !leveling2 && day <= 0 || entry.suggestion?.count === 0 || entry.budget?.fill === 0 || entry.thinMargin;
    return `<details class="mwia-skill-row${(best || leveling2 && first) && !faded ? " mwia-best" : ""}${faded ? " mwia-faded" : ""}" data-hrid="${esc(entry.hrid)}" data-open="${esc(entry.hrid)}"${view.open.has(entry.hrid) ? " open" : ""}>
      <summary><span class="mwia-skill-name">${esc(entry.action.name)}${isEnhance(entry) ? ` <span class="mwia-enh">\u2192 +${entry.target}${entry.finish ? " \u{1F9EA} decompose" : ""}</span>` : ""}${warn}<small>${sub}</small>${teaHint}${chainHint}${heldHint}</span>
        <span class="mwia-skill-nums"><b>${gold}</b>${full}<span class="mwia-dim">${coins(entry.xpPerDay * fill)} XP/day${entry.levelsPerDay !== null && entry.levelsPerDay !== void 0 ? ` \xB7 ${dec(entry.levelsPerDay, 2)} lvl/day` : ""}</span></span></summary>
      <div class="mwia-skill-detail">${detailHtml(entry, upcoming)}</div></details>`;
  }
  function detailHtml(e2, upcoming) {
    const section = (title, summary2, body) => {
      const key2 = `${e2.hrid}|${title}`;
      return `<details class="mwia-skill-sec" data-open="${esc(key2)}"${view.open.has(key2) ? " open" : ""}><summary><b>${title}</b> ${summary2}</summary>${body.map((line) => `<p>${line}</p>`).join("")}</details>`;
    };
    const sections = [];
    const buttons = upcoming ? "" : actionButtons(e2);
    const warnings = e2.warnings.map((warning) => `<p class="mwia-warn">\u26A0 ${esc(warningText(warning))}</p>`).join("");
    if (isEnhance(e2)) return buttons + warnings + enhanceSections(e2, section).join("");
    if (isAlchemy(e2)) sections.push(section("\u{1F3AF} Odds", `${pct(e2.successRate).replace("+", "")} success`, [alchemyOddsHtml(e2)]));
    const speed = e2.speed ? ` \u2192 ${dec(e2.cycleSeconds, 2)} s with ${pct(e2.speed)} speed${e2.cycleSeconds <= 3 + 1e-9 ? " (3 s is the floor)" : ""}` : "";
    const buffEfficiency = e2.efficiency - e2.levelEfficiency;
    const ac = e2.alchemyChain;
    const dc = e2.decomposeCraft;
    const own = ac || dc ? e2.ownActionsPerHour : e2.actionsPerHour;
    sections.push(section("\u23F1 Speed", `${dec(e2.actionsPerHour, 0)} actions/h`, [
      `${dec(e2.baseSeconds, 1)} s${speed}. Efficiency ${pct(e2.efficiency)} (levels ${pct(e2.levelEfficiency)}: level ${dec(e2.effectiveLevel, 0)} vs ${dec(e2.requiredLevel, 0)} ${isAlchemy(e2) ? "for the item" : "needed"}${buffEfficiency ? `, buffs ${pct(buffEfficiency)}` : ""}) \u2192 <b>${dec(own, 0)} actions/h</b>.${ac ? ` With the further steps (\u26D3) ${dec(ac.share * 100, 0)}% of each hour is this action: <b>${dec(e2.actionsPerHour, 0)} of it an hour of the chain</b>.` : ""}${dc ? ` Decomposing what it makes (\u{1F9EA}) takes the rest: ${dec(dc.share * 100, 0)}% of each hour is crafting, <b>${dec(e2.actionsPerHour, 0)} an hour of both</b>.` : ""}`
    ]));
    const gold = [];
    const outputs = e2.outputs.filter((o2) => o2.value > 0 || o2.kind === "product").map((o2) => {
      const capped2 = o2.sell.capped === "usual" ? `usual ask; ${coins(o2.sell.ask)} now` : o2.sell.capped === "spread" ? `${dec(WIDE_SPREAD, 1)}\xD7 bid; ask ${coins(o2.sell.ask)}` : o2.sell.source;
      const how = o2.sell.source === "ask" || o2.sell.source === "bid" ? ` <span class="mwia-dim">(${capped2} \u2212${dec(MARKET_TAX * 100, 0)}%)</span>` : o2.sell.source === "vendor" || o2.sell.source === "contents" ? ` <span class="mwia-dim">(${o2.sell.source})</span>` : "";
      if (o2.decomposed) return `${count(o2.count)} \xD7 ${esc(itemName(o2.itemHrid))} <span class="mwia-dim">(\u{1F9EA} decomposed, not sold)</span>`;
      if (o2.chainValue !== void 0) return `${count(o2.count)} \xD7 ${esc(itemName(o2.itemHrid))} @ <b>${coins(o2.chainValue)}</b> <span class="mwia-dim">(\u26D3 processed further; sells for ${coins(o2.price)})</span>`;
      return `${count(o2.count)} \xD7 ${esc(itemName(o2.itemHrid))} @ ${coins(o2.price)}${how}`;
    });
    const boosts = [e2.quantity && `quantity ${pct(e2.quantity)}`, e2.processing && `processing ${pct(e2.processing)}`].filter(Boolean).join(", ");
    gold.push(`<b>Each action gives</b>${boosts ? ` (${boosts})` : ""}: ${outputs.join(" \xB7 ")} = ${coins(e2.revenuePerAction)}`);
    if (e2.inputs.length) {
      const inputs = e2.inputs.map((i) => `${count(i.count)} \xD7 ${esc(itemName(i.itemHrid))} @ ${i.price === null ? "\u2013" : coins(i.price)}`);
      gold.push(`<b>Each action uses</b>${e2.artisan ? ` (artisan ${pct(-e2.artisan)})` : ""}: ${inputs.join(" \xB7 ")} = ${coins(e2.costPerAction)}`);
    }
    if (e2.teas.length) {
      gold.push(`<b>Teas:</b> ${e2.teaCosts.map((t4) => `${esc(itemName(t4.itemHrid))} @ ${coins(t4.price)}`).join(" \xB7 ")}, ${dec(e2.drinksPerHour, 1)} of each per hour = ${coins(e2.teaPerHour)}/h`);
    }
    const hours = " \xD7 24";
    gold.push(`(${coins(e2.revenuePerAction)} \u2212 ${coins(e2.costPerAction)}) \xD7 ${dec(e2.actionsPerHour, 0)}${e2.teas.length ? ` \u2212 ${coins(e2.teaPerHour)}` : ""} = ${coins(e2.profitPerHour)}/h${hours} = <b>${coins(e2.goldPerDay)}/day</b>`);
    const capped = e2.salesCap && e2.outputs.find((o2) => o2.salesCap === e2.salesCap);
    if (capped) gold.push(salesCapText(e2.salesCap, esc(itemName(capped.itemHrid)), capped.price));
    sections.push(section("\u{1F4B0} Gold", `${coins(e2.profitPerHour)}/h${e2.margin !== null ? ` \xB7 margin ${dec(e2.margin * 100, 1)}%` : ""}`, gold));
    if (e2.chain) sections.push(section("\u26D3 Yourself", `${coins(e2.chain.profitPerHour)}/h making the materials`, [chainHtml(e2)]));
    if (ac) sections.push(section("\u26D3 Further", `+${coins(e2.goldPerDay - ac.singleGoldPerDay)}/day over selling it all`, [alchemyChainHtml(e2)]));
    if (dc) sections.push(section("\u{1F9EA} Decompose", `+${coins(e2.goldPerDay - dc.singleGoldPerDay)}/day over selling ${esc(itemName(e2.action.outputItems[0].itemHrid))}`, [decomposeCraftHtml(e2)]));
    sections.push(section("\u2728 XP", `${coins(e2.xpPerHour)}/h`, [`${dec(e2.xpPerAction, 1)} per action \xD7 ${dec(e2.actionsPerHour, 0)} = ${coins(e2.xpPerHour)}/h${hours} = <b>${coins(e2.xpPerDay)}/day</b>`]));
    if (!upcoming && e2.suggestion) sections.push(section("\u{1F4E6} How many", suggestionSummary(e2.suggestion), [suggestionHtml(e2)]));
    if (!upcoming) sections.push(section("\u{1F375} Teas", teaSummary(e2), [teaHtml(e2)]));
    return buttons + warnings + sections.join("");
  }
  function alchemyOddsHtml(e2) {
    const parts = [e2.catalyst.itemHrid && `catalyst ${pct(e2.catalyst.bonus)} (${esc(itemName(e2.catalyst.itemHrid))})`, e2.successBuff && `teas and buffs ${pct(e2.successBuff)}`, e2.penalty && `<span class="mwia-warn">item level ${e2.requiredLevel} over your ${dec(e2.effectiveLevel, 0)}: ${pct(e2.penalty)}</span>`].filter(Boolean);
    const bulk = e2.bulk > 1 ? ` Each action takes ${e2.bulk} at once.` : "";
    const plus = e2.action.enhancementLevel || 0;
    const essence = plus ? ` At +${plus} it also gives round(2 \xD7 (0.5 + 0.1 \xD7 1.05^${getClientData().itemDetailMap[e2.action.itemHrid]?.itemLevel || 0}) \xD7 2^${plus}) = ${count(decomposeEssence(getClientData().itemDetailMap[e2.action.itemHrid]?.itemLevel, plus))} Enhancing Essence on a success.${e2.inputs[0]?.forSale === false ? " Nobody sells one at that +level: only yours, counted at what they would sell for." : ""}` : "";
    const coinsText = e2.coinCost ? ` It costs ${coins(e2.coinCost)} coins, lost on a failure like the item.` : "";
    const catalyst = e2.catalyst.itemHrid ? ` The catalyst is used up only on a success (${coins(e2.catalyst.price)} each).` : " No catalyst pays off with your Focus.";
    return `${dec(e2.baseRate * 100, 0)}% base${parts.length ? ` \xD7 (1 ${parts.map((p2) => "+ " + p2).join(" ")})` : ""} = <b>${dec(e2.successRate * 100, 2)}%</b>.${bulk}${essence}${coinsText}${catalyst} <span class="mwia-dim">A failure still gives a tenth of the XP.</span>`;
  }
  function enhanceSections(e2, section) {
    const sections = [];
    const item = esc(itemName(e2.action.itemHrid));
    const parts = [e2.levelBonus && `level ${dec(e2.effectiveLevel, 0)} vs item ${e2.requiredLevel}: ${pct(e2.levelBonus)}`, e2.successBonus && `tool, house and buffs ${pct(e2.successBonus)}`].filter(Boolean);
    const rates = e2.rates.slice(0, Math.max(e2.target, 3)).map((r, L2) => `+${L2}\u2192+${L2 + 1} ${dec(r * 100, 1)}%`).join(" \xB7 ");
    const pr = e2.protect;
    sections.push(section("\u{1F3AF} Odds", `${count(e2.attempts)} attempts per +${e2.target}${pr ? `, protected from +${pr.from}` : ""}`, [
      `Success = the game's rate for the +level \xD7 ${dec(e2.multiplier, 3)}${parts.length ? ` (1 ${parts.map((p2) => "+ " + p2).join(" ")})` : ""}: ${rates}.${e2.blessed ? ` Blessed: ${pct(e2.blessed).replace("+", "")} of successes jump two levels.` : ""}`,
      pr ? `A failure below +${pr.from} drops the item to +0; from +${pr.from} on it drops one level and uses up one ${esc(itemName(pr.itemHrid))} (the cheapest protection, ${coins(pr.price)}). From +0 it takes <b>${count(e2.attempts)} attempts</b> and ${count(pr.protections)} protections on average to reach +${e2.target}. Protecting from another +level, or not at all, suits your Focus less.` : `A failure drops the item to +0. From +0 it takes <b>${count(e2.attempts)} attempts</b> on average to reach +${e2.target}.${e2.target > MIN_PROTECT ? " Protection doesn't pay here with your Focus." : ""}`
    ]));
    const levelSpeed = e2.levelSpeed ? ` (levels ${pct(e2.levelSpeed)})` : "";
    const fin = e2.finish;
    const split = fin ? ` Decomposing each takes ${dec(fin.hours * 3600, 1)} s of Alchemy, so of each hour ${dec(e2.enhanceShare * 100, 0)}% is enhancing and ${dec((1 - e2.enhanceShare) * 100, 0)}% decomposing; the gold and XP are per hour of both.` : "";
    sections.push(section("\u23F1 Speed", `${dec(e2.actionsPerHour, 0)} attempts/h`, [`12 s / (1 + ${pct(e2.speed).replace("+", "")} speed${levelSpeed}) = ${dec(e2.cycleSeconds, 2)} s \u2192 <b>${dec(e2.actionsPerHour, 0)} attempts/h</b>, ${count(e2.itemsPerHour)} items reach +${e2.target} an hour.${split}`]));
    const sell = fin ? e2.sold : e2.outputs[0].sell;
    const sold = sell.source === "vendor" ? "the shop price" : sell.source === "lower" ? `the +${sell.level} bid (nobody bids for +${e2.target})` : sell.source === "usualbid" ? "the usual bid (nobody bids now)" : sell.source === "usual" ? `the usual ask (${coins(sell.ask)} now)` : sell.source === "spread" ? `${dec(WIDE_SPREAD, 1)}\xD7 the bid (ask ${coins(sell.ask)})` : `the ${sell.source}`;
    const mats = e2.inputs.filter((i) => !i.upgrade).map((i) => `${count(i.count)} \xD7 ${esc(itemName(i.itemHrid))}${i.protection ? " (protection)" : ""} @ ${coins(i.price)}`).join(" \xB7 ");
    const base = e2.base.owned ? `one you have (worth ${coins(e2.base.price)} at the bid)` : `bought at ${coins(e2.base.price)}`;
    sections.push(section("\u{1F4B0} Gold", `${coins(e2.profitPerHour)}/h`, [
      `<b>Each attempt uses</b> ${mats} = ${coins(e2.costPerAttempt)}.`,
      `<b>Each attempt may drop</b> ${e2.outputs.slice(1).map((o2) => `${count(o2.count)} \xD7 ${esc(itemName(o2.itemHrid))} @ ${coins(o2.price)}`).join(" \xB7 ")} = ${coins(e2.dropsPerAttempt)}.`,
      fin ? `<b>Each +${e2.target}</b> (one per ${count(e2.attempts)} attempts): the item ${base}${fin.itemFloor > e2.base.price ? ` \u2013 counted at ${coins(fin.itemFloor)}, what decomposing it as it is gives (that gain is the Alchemy list's)` : ""}, then <b>decomposed</b> instead of sold: ${decomposeText(fin)} = <b>${coins(fin.value)}</b> each, against ${coins(sell.price)} selling it at ${sold}.` : `<b>Each +${e2.target}</b> (one per ${count(e2.attempts)} attempts): the item ${base}, sold at ${sold} for ${coins(sell.price)} after tax.${sell.sold !== null && sell.sold !== void 0 ? ` About ${soldText(sell.sold)} +${e2.target} sell a day; you'd make ${count(e2.itemsPerHour * 24)}.` : ""}`,
      e2.salesCap ? `<span class="mwia-warn">The market takes about ${soldText(e2.salesCap.perDay)} a day; the rest of the ${count(e2.salesCap.made)} you'd make go for ${coins(e2.salesCap.floor)} (the ${sell.floorLevel === null ? "shop" : `+${sell.floorLevel} bid`}): ${coins(e2.outputs[0].price)} each on average.</span>` : "",
      budgetText(e2.budget),
      e2.teas.length ? `<b>Teas:</b> ${e2.teaCosts.map((t4) => `${esc(itemName(t4.itemHrid))} @ ${coins(t4.price)}`).join(" \xB7 ")}, ${dec(e2.drinksPerHour, 1)} of each per hour = ${coins(e2.teaPerHour)}/h.` : "",
      `${fin ? "(" : ""}(${coins(e2.revenuePerAction)} \u2212 ${coins(e2.costPerAction)}) \xD7 ${dec(e2.actionsPerHour, 0)}${e2.teas.length ? ` \u2212 ${coins(e2.teaPerHour)}` : ""}${fin ? `) \xD7 ${dec(e2.enhanceShare * 100, 1)}% enhancing` : ""} = ${coins(e2.profitPerHour)}/h \xD7 24 = <b>${coins(e2.goldPerDay)}/day</b>.`
    ].filter(Boolean)));
    const finXp = fin ? ` \xD7 ${dec(e2.enhanceShare * 100, 1)}% enhancing` : "";
    const alchemyXp = fin ? ` Decomposing adds ${dec(fin.xp, 1)} Alchemy XP per item (${coins(fin.xp * e2.itemsPerHour * 24)}/day), not counted here.` : "";
    sections.push(section("\u2728 XP", `${coins(e2.xpPerHour)}/h`, [`1.4 \xD7 (1 + the +level) \xD7 (10 + ${e2.requiredLevel})${e2.wisdom ? ` \xD7 ${dec(1 + e2.wisdom, 3)} wisdom` : ""} on a success, a tenth on a failure: ${dec(e2.xpPerAction, 1)} per attempt on average \xD7 ${dec(e2.actionsPerHour, 0)}${finXp} = ${coins(e2.xpPerHour)}/h = <b>${coins(e2.xpPerDay)}/day</b>.${alchemyXp}`]));
    const rows = e2.targets.filter((t4) => t4.target <= 12 || t4.target === e2.target || t4.target % 5 === 0).map((t4) => {
      const perXp = t4.coinsPerXp === null ? "\u2013" : t4.coinsPerXp >= 0 ? `${dec(t4.coinsPerXp, 1)} c/XP` : `earns ${dec(-t4.coinsPerXp, 1)}/XP`;
      const text = `+${t4.target}: ${count(t4.attempts)} attempts${t4.protect ? ` (protect from +${t4.protect.from})` : ""}${t4.finish ? " \xB7 \u{1F9EA} decompose" : ""} \xB7 ${coins(t4.goldPerDay)}/day \xB7 ${coins(t4.xpPerDay)} XP/day \xB7 ${perXp}`;
      return t4.target === e2.target ? `<b>${text}</b>` : text;
    });
    sections.push(section("\u{1F39A} Targets", `+${e2.target} suits your Focus`, [`Stopping at a lower +level sells the item sooner (more of it comes back, each attempt gives less XP); a high target almost never gets there, so it is all materials. \u{1F9EA}: decomposing the +level (Alchemy, with the teas in your Alchemy slots) suits your Focus better than selling it, counting the Alchemy time. With ${item}:`, rows.join("<br>")]));
    sections.push(section("\u{1F375} Teas", teaSummary(e2), [teaHtml(e2)]));
    return sections;
  }
  function decomposeCraftHtml(e2) {
    const dc = e2.decomposeCraft;
    const item = esc(itemName(e2.action.outputItems[0].itemHrid));
    const back = dc.reused.map((x) => `${count(x.count)} ${esc(itemName(x.itemHrid))} <span class="mwia-dim">(@ ${coins(x.price)}, not bought)</span>`);
    const sold = dc.sold.filter((x) => x.value > 0.5 || x.kind === "recovered").map((x) => `${count(x.count)} ${esc(itemName(x.itemHrid))} @ ${coins(x.price)}`);
    const r = dc.decompose;
    return `Each ${item} is decomposed (Alchemy, ${dec(r.successRate * 100, 1)}% success with the teas in your Alchemy slots${r.catalyst?.itemHrid ? ` and ${esc(itemName(r.catalyst.itemHrid))}` : ""}, ${coins(r.coinCost)} coins) instead of sold for ${coins(dc.sellPrice)}: worth <b>${coins(dc.valuePerItem)}</b> each.
        Per craft it gives back ${back.join(" \xB7 ")}${sold.length ? `, and ${sold.join(" \xB7 ")} to sell` : ""}.
        <br>Of each hour ${dec(dc.share * 100, 0)}% is crafting and ${dec((1 - dc.share) * 100, 0)}% decomposing: <b>${coins(e2.goldPerDay)}/day</b> against ${coins(dc.singleGoldPerDay)}/day selling them, and the XP is the craft's (${coins(e2.xpPerDay)}/day; Alchemy gets ${coins(dc.alchemyXpPerHour * 24)} XP/day too).
        <span class="mwia-dim">Each decompose is one roll \u2013 a failure loses the item \u2013 so it evens out over many. \u25B6 makes the items; then decompose them and craft again with what comes back.</span>`;
  }
  function alchemyChainHtml(e2) {
    const ac = e2.alchemyChain;
    const perHour = (f) => f.count * e2.actionsPerHour;
    const steps = ac.further.map((f) => `${esc(f.name)}: ${count(perHour(f))} an hour <span class="mwia-dim">(${dec(f.hours * e2.actionsPerHour * 100, 0)}% of the time, ${dec(f.successRate * 100, 0)}% success${f.catalyst ? `, ${esc(itemName(f.catalyst))}` : ""})</span>`);
    const sold = ac.sold.map((x) => `${count(x.count * e2.actionsPerHour)} ${esc(itemName(x.itemHrid))}`);
    return `What this action gives is worth more processed further than sold. Of each hour ${dec(ac.share * 100, 0)}% is ${esc(e2.action.name)}; then:<br>${steps.join("<br>")}
        ${sold.length ? `<br>Sold, an hour: ${sold.join(" \xB7 ")}.` : ""}
        <br>Gold an hour of the whole chain: <b>${coins(e2.profitPerHour)}/h = ${coins(e2.goldPerDay)}/day</b>, against ${coins(ac.singleGoldPerDay)}/day selling all it gives.
        <span class="mwia-dim">Each further step is chosen when it gives more than selling, counting its hours at the chain's own gold an hour; all with this row's teas. \u25B6 starts this action only \u2013 queue the further steps as their outputs come in.</span>`;
  }
  function decomposeText(fin) {
    const r = fin.entry;
    const outs = r.outputs.filter((o2) => o2.value > 0).map((o2) => `${count(o2.count)} \xD7 ${esc(itemName(o2.itemHrid))} @ ${coins(o2.price)}`).join(" + ");
    const costs = r.inputs.filter((i) => i.itemHrid === COIN4 || i.catalyst).map((i) => i.itemHrid === COIN4 ? `${coins(i.value)} coins` : `${count(i.count)} \xD7 ${esc(itemName(i.itemHrid))}`).join(" \u2212 ");
    const teas = r.teaPerHour > 0 ? ` \u2212 ${coins(r.teaPerHour / r.actionsPerHour)} of Alchemy teas` : "";
    return `${dec(r.successRate * 100, 1)}% success, ${outs}${costs ? ` \u2212 ${costs}` : ""}${teas}`;
  }
  function chainHtml(e2) {
    const c2 = e2.chain;
    const shares = [`${dec(c2.craftShare * 100, 0)}% ${esc(e2.action.name)}`, ...[...c2.shares].sort((a, b) => b.share - a.share).map((s2) => `${dec(s2.share * 100, 0)}% ${esc(itemName(s2.itemHrid))} <span class="mwia-dim">(${skillLabel(s2.action.type.split("/").pop())}, ${count(s2.count)} each)</span>`)];
    const better2 = c2.profitPerHour > e2.profitPerHour;
    return `Make every material your levels allow, buy the rest: <b>${coins(c2.profitPerHour)}/h = ${coins(c2.goldPerDay)}/day</b>
        <span class="${better2 ? "mwia-ok" : "mwia-dim"}">(${better2 ? "+" : "\u2212"}${coins(Math.abs(c2.goldPerDay - e2.goldPerDay))}/day vs buying)</span>.
        <br>Of each hour: ${shares.join(" \xB7 ")}.${c2.bought.length ? `<br>Still bought: ${esc(names(c2.bought))}.` : ""}
        <br><span class="mwia-dim">Each step uses that skill's teas; the gold is per hour of the whole chain.</span>${chainTrainText(e2)}`;
  }
  function chainTrainText(e2) {
    const t4 = e2.chainSuggestion;
    if (!t4) return "";
    const rating = `${RATING[t4.liquidity.rating]}${t4.ratedBy ? ` (${esc(itemName(t4.ratedBy))})` : ""}`;
    const coinsText = e2.chain.cashPerAction > 0 ? ` What it buys may take ${Math.round(t4.coinShare * 100)}% of your coins (${coins(t4.budget)}) for a ${rating}${t4.limitedByCoins ? " \u2013 that caps it" : ""}.` : "";
    if (!t4.count) return `<br>\u{1F682} Nothing to train: ${t4.heldOff ? "you already hold a day of sales" : "your coins don't stretch to one"}.${coinsText}`;
    return `<br>\u{1F682} <b>Train ${t4.count.toLocaleString("en-US")}</b>: the whole chain in about ${hoursText(t4.hours)}${t4.heldOff ? `, less the ${t4.heldOff.toLocaleString("en-US")} you hold` : ""}${t4.cash > 1 ? `, ${coins(t4.cash)} of materials to buy` : ""}.${coinsText}`;
  }
  function levelingButtons(e2) {
    const item = e2.action.itemHrid;
    const hours = e2.teaPlan?.hours || PLAN_MODES.away.hours;
    let open2;
    let buy;
    if (isEnhance(e2)) {
      const guard = e2.protect ? ` data-protect="${esc(e2.protect.itemHrid)}" data-protect-from="${e2.protect.from}"` : "";
      open2 = `<button class="mwia-btn" data-action="skilling-level" data-kind="enhance" data-item="${esc(item)}" data-value="${e2.target}"${guard} title="Opens Enhancing with ${esc(itemName(item))} (one from your inventory) and the target +${e2.target}${e2.protect ? `, protected from +${e2.protect.from} with ${esc(itemName(e2.protect.itemHrid))}` : ""}">\u25B6 Enhance to +${e2.target}</button>${loopButton(e2)}${decomposeButton(decomposeHeld(e2))}`;
      const attempts = Math.ceil(e2.actionsPerHour * hours * (e2.enhanceShare ?? 1));
      const items = e2.inputs.filter((i) => !i.upgrade && !(i.protection && i.itemHrid === item)).map((i) => ({ hrid: i.itemHrid, quantity: Math.ceil(i.count * attempts) })).filter((i) => i.hrid !== COIN4);
      const guards = e2.protect?.itemHrid === item ? attempts * e2.protect.protections / e2.attempts : 0;
      const copies = Math.max(e2.base.owned ? 0 : 1, Math.ceil(attempts / e2.attempts + guards) - have(item));
      if (copies > 0) items.unshift({ hrid: item, quantity: copies });
      const catalyst = e2.finish?.entry?.inputs.find((i) => i.catalyst);
      const catalysts = catalyst ? Math.ceil(attempts / e2.attempts * catalyst.count - 1e-9) - have(catalyst.itemHrid) : 0;
      if (catalysts > 0) items.push({ hrid: catalyst.itemHrid, quantity: catalysts });
      buy = items.length ? { items, title: `Adds what ${hoursText(hours)} of enhancing uses: ${items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", ")}` } : null;
    } else {
      const k = ALCHEMY_KINDS[e2.action.kind];
      const n5 = e2.suggestion?.count || 0;
      const plus = e2.action.enhancementLevel || 0;
      const catalyst = e2.catalyst?.itemHrid ? ` data-catalyst="${esc(e2.catalyst.itemHrid)}"` : "";
      open2 = `<button class="mwia-btn" data-action="skilling-level" data-kind="alchemy" data-item="${esc(item)}"${plus ? ` data-level="${plus}"` : ""} data-label="${esc(k.name)}" data-value="${n5}"${catalyst} title="Opens ${k.name} with ${esc(itemName(item))}${plus ? ` +${plus}` : ""} (from your inventory)${n5 ? ` and ${n5} actions` : ""}${e2.catalyst?.itemHrid ? `, with ${esc(itemName(e2.catalyst.itemHrid))}` : ""}">\u25B6 ${k.name}${n5 ? ` ${n5.toLocaleString("en-US")}` : ""}</button>`;
      const items = n5 ? e2.inputs.filter((i) => i.itemHrid !== COIN4 && i.forSale !== false).map((i) => ({ hrid: i.itemHrid, ...i.enhancementLevel ? { enhancementLevel: i.enhancementLevel } : {}, quantity: Math.max(0, Math.ceil(i.count * n5) - have(i.itemHrid, i.enhancementLevel || 0)) })).filter((i) => i.quantity > 0) : [];
      buy = items.length ? { items, title: `Adds what ${n5.toLocaleString("en-US")} actions use, less what you have: ${items.map((i) => `${i.quantity} ${itemName(i.hrid)}${i.enhancementLevel ? ` +${i.enhancementLevel}` : ""}`).join(", ")}` } : null;
    }
    const cart = buy ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-cart" data-job="${esc(e2.hrid)}" data-teas="${esc(JSON.stringify(buy.items))}" title="${esc(buy.title)}">\u{1F6D2} Materials</button>` : "";
    const plan = e2.teaPlan;
    const teas = plan?.items.length ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-cart" data-teas="${esc(JSON.stringify(plan.items.map(({ hrid, quantity }) => ({ hrid, quantity }))))}" title="Adds the best teas for ${hoursText(plan.hours)} to the MWITools cart">\u{1F375} Buy teas</button>` : "";
    const plusLevel = isAlchemy(e2) ? e2.action.enhancementLevel || 0 : 0;
    const market = `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-market" data-item="${esc(item)}"${plusLevel ? ` data-level="${plusLevel}"` : ""} title="Opens ${esc(itemName(item))}${plusLevel ? ` +${plusLevel}` : ""} on the market">\u{1F3EA} Market</button>`;
    return `<div class="mwia-skill-buttons">${open2}${cart}${teas}${market}</div>`;
  }
  function decomposeHeld(e2) {
    const r = isEnhance(e2) ? e2.finish?.entry : e2.decomposeCraft?.decompose;
    if (!r) return null;
    const item = isEnhance(e2) ? e2.action.itemHrid : e2.action.outputItems?.[0]?.itemHrid;
    const detail = item && getClientData()?.itemDetailMap[item];
    if (!detail) return null;
    const level = isEnhance(e2) ? e2.target : 0;
    const bulk = bulkOf(detail);
    const held = have(item, level);
    return { item, level, held, bulk, actions: Math.floor(held / bulk), catalyst: r.catalyst?.itemHrid || null };
  }
  function decomposeButton(d) {
    if (!d?.actions) return "";
    const name = `${esc(itemName(d.item))}${d.level ? ` +${d.level}` : ""}`;
    const catalyst = d.catalyst ? ` data-catalyst="${esc(d.catalyst)}"` : "";
    return `<button class="mwia-btn" data-action="skilling-level" data-kind="alchemy" data-item="${esc(d.item)}"${d.level ? ` data-level="${d.level}"` : ""} data-label="Decompose" data-value="${d.actions}" data-all="${d.bulk}"${catalyst} title="Opens Decompose with the ${d.held.toLocaleString("en-US")} ${name} you have${d.catalyst ? `, with ${esc(itemName(d.catalyst))}` : ""}">\u{1F9EA} Decompose ${d.actions.toLocaleString("en-US")}${d.level ? ` \xD7 +${d.level}` : ""}</button>`;
  }
  function loopButton(e2) {
    const r = e2.finish?.entry;
    if (!r) return "";
    const item = e2.action.itemHrid;
    const per = /* @__PURE__ */ new Map([[item, 1]]);
    for (const i of e2.inputs) if (!i.upgrade && i.itemHrid !== COIN4) per.set(i.itemHrid, (per.get(i.itemHrid) || 0) + i.count * e2.attempts);
    const catalyst = r.inputs.find((i) => i.catalyst);
    if (catalyst) per.set(catalyst.itemHrid, (per.get(catalyst.itemHrid) || 0) + catalyst.count);
    const loop = { itemHrid: item, target: e2.target, protect: e2.protect ? { itemHrid: e2.protect.itemHrid, from: e2.protect.from } : null, catalyst: r.catalyst?.itemHrid || null, perItem: [...per].map(([hrid, quantity]) => ({ hrid, quantity })) };
    const held = have(item);
    if (!held) return `<button class="mwia-btn" disabled title="No ${esc(itemName(item))} at +0 in your inventory \u2013 buy them first (\u{1F6D2} Materials)">\u{1F501} Loop</button>`;
    return `<button class="mwia-btn" data-action="enhance-loop" data-loop="${esc(JSON.stringify(loop))}" title="A loop for the ${held.toLocaleString("en-US")} ${esc(itemName(item))} you have at +0: one enhancing job each to +${e2.target} (queue them one after another), then decompose them all. A small panel counts what the game confirms.">\u{1F501} Loop ${held.toLocaleString("en-US")}</button>`;
  }
  function actionButtons(e2) {
    if (isEnhance(e2) || isAlchemy(e2)) return levelingButtons(e2);
    const crafted = e2.action.function === "/action_functions/production";
    const productHrid = e2.action.outputItems?.[0]?.itemHrid;
    const s2 = e2.suggestion;
    const make = (crafted && s2?.count ? `<button class="mwia-btn" data-action="skilling-make" data-hrid="${esc(e2.hrid)}" data-count="${s2.count}">\u25B6 Make ${s2.count.toLocaleString("en-US")}</button>` : "") + decomposeButton(decomposeHeld(e2));
    const plan = e2.teaPlan;
    const teas = plan?.items.length ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-cart" data-teas="${esc(JSON.stringify(plan.items.map(({ hrid, quantity }) => ({ hrid, quantity }))))}" title="Adds the best teas for ${hoursText(plan.hours)} to the MWITools cart: ${esc(plan.items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", "))}">\u{1F375} Buy teas</button>` : "";
    const train = trainButton(e2);
    const market = crafted ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-market" data-item="${esc(productHrid)}" title="Opens ${esc(itemName(productHrid))} on the market. Not needed for the advice; the orders you see there are shown under How many.">\u{1F3EA} Market</button>` : "";
    return make || train || teas || market ? `<div class="mwia-skill-buttons">${make}${train}${teas}${market}</div>` : "";
  }
  function trainButton(e2) {
    const t4 = e2.chainSuggestion;
    if (!t4?.count) return "";
    const product = e2.action.outputItems[0].itemHrid;
    const made = [product, ...e2.chain.shares.filter((s2) => s2.action.function === "/action_functions/production").map((s2) => s2.itemHrid)];
    const plan = { product, target: Math.ceil(t4.count * e2.mainCount - 1e-9) + have(product), made, title: `${itemName(product)} \xD7${t4.count.toLocaleString("en-US")}` };
    return `<button class="mwia-btn" data-action="skilling-train" data-plan="${esc(JSON.stringify(plan))}" title="Starts a train: the materials made and gathered first, then ${t4.count.toLocaleString("en-US")} ${esc(itemName(product))} \u2013 about ${hoursText(t4.hours)} in all">\u{1F682} Train ${t4.count.toLocaleString("en-US")}</button>`;
  }
  function teaGain(best, current) {
    const gold = best.goldPerDay - current.goldPerDay;
    return gold >= 0 ? `+${coins(gold)}/day` : `+${coins(best.xpPerDay - current.xpPerDay)} XP/day`;
  }
  function teaSummary(entry) {
    const { best } = entry;
    if (entry.betterTeas) return `best: ${esc(names(best.result.teas)) || "none"} <span class="mwia-ok">${teaGain(best.result, entry.current)}</span>`;
    if (!best.result.teas.length) return "none pays off";
    return "yours are the best";
  }
  function teaHtml(entry) {
    const { current, best } = entry;
    const now2 = (current.teas.length ? `Your teas: ${esc(names(current.teas))}.` : "You have no teas in this skill.") + ` ${slotsLine(entry)}`;
    if (!entry.betterTeas) {
      if (!best.result.teas.length) return `${now2} No tea earns back its cost here.`;
      return `${now2} That is already the best setup. ${worthText(best.worth)}${purchaseText(entry.teaPlan)}`;
    }
    return `${now2} Best: <b>${esc(names(best.result.teas)) || "none"}</b> \u2192 ${coins(best.result.goldPerDay)}/day, ${coins(best.result.xpPerDay)} XP/day
        (<span class="mwia-ok">${teaGain(best.result, current)}</span>). ${worthText(best.worth)}${purchaseText(entry.teaPlan)}`;
  }
  function slotsLine(entry) {
    const n5 = entry.teaSlots;
    return `<span class="mwia-dim">${n5} tea slot${n5 === 1 ? "" : "s"} (${entry.pouch ? esc(itemName(entry.pouch)) : "no pouch"}).</span>`;
  }
  function worthText(worth) {
    if (!worth.length) return "";
    return worth.map((w) => w.gainPerDay >= 0 ? `${esc(itemName(w.itemHrid))} earns ${coins(w.gainPerDay)}/day more than it costs.` : `${esc(itemName(w.itemHrid))} costs ${coins(-w.gainPerDay)}/day and adds ${coins(w.xpPerDay)} XP/day.`).join(" ");
  }
  function purchaseText(plan) {
    if (!plan) return "";
    const have6 = plan.items.length ? ` To buy: ${plan.items.map((i) => `${i.quantity.toLocaleString("en-US")} ${esc(itemName(i.hrid))}${i.have ? ` (you have ${i.have.toLocaleString("en-US")})` : ""}`).join(", ")}.` : " You have enough of each.";
    return `<br>For this job (${hoursText(plan.hours)}): ${plan.perTea.toLocaleString("en-US")} of each.${have6}`;
  }
  function budgetShort(b) {
    if (!b || b.fill >= 1) return "";
    if (b.fill === 0) return ` \xB7 <span class="mwia-warn">the item (${coins(b.item)}) is over ${Math.round(b.share * 100)}% of your coins</span>`;
    return ` \xB7 your coins last ${hoursText(b.hours)} of ${hoursText(b.plannedHours)}`;
  }
  function budgetText(b) {
    if (!b) return "";
    const rating = `${RATING[b.rating.rating]}${b.rating.known ? "" : " (too little history)"}`;
    const what = `${b.item ? `the item (${coins(b.item)}) and ` : ""}${hoursText(b.plannedHours)} of materials and teas (${coins(b.perHour)}/h) need ${coins(b.need)}; the item's market is a ${rating}, so up to ${Math.round(b.share * 100)}% of your coins (${coins(b.budget)}) may go into it`;
    if (b.fill === 0) return `<span class="mwia-warn">${what} \u2013 not enough for the item itself.</span>`;
    if (b.fill < 1) return `<span class="mwia-warn">${what} \u2013 enough for ${hoursText(b.hours)}.</span>`;
    return `<span class="mwia-dim">${what}.</span>`;
  }
  function suggestionShort(suggestion) {
    if (!suggestion?.known) return "";
    return " \xB7 " + suggestionSummary(suggestion);
  }
  function suggestionSummary(s2) {
    const rating = RATING[s2.liquidity.rating] + (s2.ratedBy ? " (materials)" : "");
    if (!s2.count) return `${rating} \xB7 ${s2.heldOff ? s2.productLiquidity.sold?.enough ? "you hold a day of sales" : "you hold enough" : s2.cappedBySales && !s2.plannedUnits ? "none sold lately" : "your coins don't stretch to one"}`;
    const time2 = s2.fill < SHORT_FILL ? `<span class="mwia-warn">${hoursText(s2.hours)} of ${hoursText(s2.plannedHours)}${SHORT_WHY[s2.short] ? ` \u2013 ${SHORT_WHY[s2.short](s2)}` : ""}</span>` : hoursText(s2.hours);
    return `${rating} \xB7 ${s2.verb || "make"} ${s2.count.toLocaleString("en-US")} (${time2}) \xB7 ${coins(s2.batch.materials)} in, ${s2.batch.profit >= 0 ? "+" : "\u2212"}${coins(Math.abs(s2.batch.profit))}`;
  }
  var SHORT_FILL = 0.95;
  var SHORT_WHY = {
    owned: () => "the ones you have",
    onelisted: (s2) => `one ${esc(itemName(s2.limitedByListing))} +${s2.inputs.find((i) => i.itemHrid === s2.limitedByListing)?.enhancementLevel} known listed`,
    held: (s2) => `${s2.held.toLocaleString("en-US")} in stock`,
    sales: () => "a day of sales",
    swing: () => "price swings",
    book: (s2) => `few ${esc(itemName(s2.limitedByBook))} listed`,
    coins: () => "coins"
  };
  function salesCapText(cap3, name, mean) {
    return `<span class="mwia-warn">The market takes about ${soldText(cap3.perDay)} ${name} a day; made all day you'd have ${count(cap3.made)}, the rest going for ${coins(cap3.floor)}: ${coins(mean)} each on average.</span>`;
  }
  function liquidityText(l2) {
    const share = (x) => `${Math.round(x * 100)}%`;
    if (l2.coin) return "It gives coins: no buyer needed. The materials' markets set how much of your coins it may take.";
    if (l2.reused) return "What it makes is decomposed and its materials used again: no buyer needed. The materials' markets set how much of your coins it may take.";
    if (!l2.known) return `${RATING.thin}: under ${MIN_HOURS} hours of prices for it yet${l2.hours ? ` (${l2.hours})` : ""}, so it is treated as thin.`;
    const parts = [
      `a buyer and a seller in ${share(l2.both)} of the hours`,
      `spread ${dec(l2.spread * 100, 1)}%`,
      `price swings \xB1${dec(l2.swing * 100, 1)}%`
    ];
    const sales = l2.sold?.enough;
    parts.push(sales ? `something sold in ${share(l2.sold.selling)} of the hours` : `the lowest ask moved in ${share(l2.activity)} of the hours`);
    const s2 = LIQUIDITY.stable;
    const spikes = l2.sold?.enough && l2.sold.rawPerDay > l2.sold.perDay * 1.1 ? `; ${soldText(l2.sold.rawPerDay)} counting a few big hours in full` : "";
    const sold = l2.sold?.enough ? ` About <b>${soldText(l2.sold.perDay)} sold a day</b> (${l2.sold.hours} hours of sales${spikes}).` : "";
    const note2 = sales ? "" : " Until 12 hours of sales are collected, how often the lowest ask moves stands in for them.";
    return `${RATING[l2.rating]} over the last ${l2.hours} hours of prices: ${parts.join(", ")}.${sold} <span class="mwia-dim">Stable needs \u2265 ${share(s2.both)}, \u2264 ${share(s2.spread)}, \u2264 \xB1${share(s2.swing)} and \u2265 ${share(sales ? s2.selling : s2.activity)}; ok \u2265 ${share(LIQUIDITY.ok.both)}, \u2264 ${share(LIQUIDITY.ok.spread)}, \u2264 \xB1${share(LIQUIDITY.ok.swing)}${sales ? ` and \u2265 ${share(LIQUIDITY.ok.selling)}` : ""}.${note2}</span>`;
  }
  var ago = (at2) => hoursText((Date.now() - at2) / 36e5);
  var soldText = (n5) => n5 >= 10 ? Math.round(n5).toLocaleString("en-US") : dec(n5, 1);
  var have = (hrid, level = 0) => level > 0 ? heldAt(hrid, level) : heldStock(state.character, state.items, hrid).inventory;
  var heldAt = (hrid, level) => [...state.items.values()].filter((i) => i.itemHrid === hrid && i.itemLocationHrid === INVENTORY2 && (i.enhancementLevel || 0) === level).reduce((sum, i) => sum + (i.count || 0), 0);
  function heldLevels(hrid) {
    const levels = [];
    for (const i of state.items.values()) if (i.itemHrid === hrid && i.itemLocationHrid === INVENTORY2 && i.enhancementLevel > 0 && i.count > 0) levels.push(i.enhancementLevel);
    return levels;
  }
  function materialsText(s2) {
    const shown = s2.inputs.filter((i) => i.toBuy > 0);
    if (!shown.length) return "";
    const parts = shown.map((i) => {
      const rating = i.liquidity || { rating: "thin", known: false };
      let text = `${i.toBuy.toLocaleString("en-US")} ${esc(itemName(i.itemHrid))} ${RATING[rating.rating]}${rating.known ? "" : " (too little history)"}`;
      if (i.bookAt) text += ` \u2013 ${i.nearAsks.toLocaleString("en-US")} listed at \u2264 ${coins(i.maxPrice)} ${ago(i.bookAt)} ago${i.averagePrice > i.lowestAsk * 1.0005 ? `, ${coins(i.averagePrice)} each on average (lowest ${coins(i.lowestAsk)})` : ""}`;
      else if (rating.rating !== "stable") text += ` \u2013 <i>open it on the market to see how many are for sale</i>`;
      return i.itemHrid === s2.ratedBy || i.itemHrid === s2.limitedByBook ? `<span class="mwia-warn">${text}</span>` : text;
    });
    const by = s2.ratedBy ? ` <span class="mwia-dim">The coins follow the thinnest market: ${esc(itemName(s2.ratedBy))}.</span>` : "";
    return `To buy: ${parts.join(" \xB7 ")}.${by}`;
  }
  function suggestionHtml(e2) {
    const s2 = e2.suggestion;
    const product = esc(itemName(e2.action.outputItems[0].itemHrid));
    const lines = [liquidityText(s2.productLiquidity)];
    let plan = isAlchemy(e2) ? `A ${hoursText(s2.plannedHours)} job is ${Math.round(s2.plannedUnits / e2.mainCount).toLocaleString("en-US")} actions${e2.bulk > 1 ? ` of ${e2.bulk} ${esc(itemName(e2.action.itemHrid))} each` : ""}` : s2.cappedBySales ? `A ${hoursText(s2.plannedHours)} job would make more than sells in a day: about a day of sales is ${s2.plannedUnits.toLocaleString("en-US")} ${product}` : `A ${hoursText(s2.plannedHours)} job is ${s2.plannedUnits.toLocaleString("en-US")} ${product}`;
    const where = `(${s2.stock.inventory.toLocaleString("en-US")} in inventory, ${s2.stock.listed.toLocaleString("en-US")} listed)`;
    const sold = s2.productLiquidity.sold?.enough ? soldText(s2.productLiquidity.sold.perDay) : null;
    if (s2.heldOff) plan += ` \u2212 ${s2.heldOff === s2.held ? "the" : `${s2.heldOff.toLocaleString("en-US")} of the`} ${s2.held.toLocaleString("en-US")} you already have ${where}${sold && !s2.cappedBySales ? `: with them, more than the ~${sold} that sell in a day` : ""}`;
    lines.push(plan + ".");
    if (s2.held && !s2.heldOff) lines.push(`<span class="mwia-dim">The ${s2.held.toLocaleString("en-US")} you already have ${where} don't shorten it: the market takes about ${sold} a day.</span>`);
    const sw = s2.swing;
    if (sw && sw.share < 1) {
      const why = [];
      if (sw.bySwing < 1) why.push(`its price usually swings \xB1${Math.round(sw.swing * 100)}%`);
      if (sw.high) why.push(`it is ${Math.round(sw.diff * 100)}% above its usual price now \u2013 sell it while it lasts`);
      lines.push(`Made ${Math.round(sw.share * 100)}% of that: ${why.join(", and ")}.`);
    }
    if (sw?.low) lines.push(`<span class="mwia-warn">It sells ${Math.round(-sw.diff * 100)}% below its usual price now \u2013 waiting, or making something else, may pay.</span>`);
    const budget = `${Math.round(s2.coinShare * 100)}% of your coins (${coins(s2.budget)}) for a ${s2.liquidity.rating} market`;
    if (s2.limitedByCoins) lines.push(`<span class="mwia-warn">Materials capped at ${budget}.</span>`);
    else lines.push(`<span class="mwia-dim">Materials may take up to ${budget}.</span>`);
    const materials2 = materialsText(s2);
    if (materials2) lines.push(materials2);
    if (s2.inputs.some((i) => i.bookAt)) lines.push(`<span class="mwia-dim">A material seen on the market is bought up from its lowest ask while the last action still makes ${s2.minMargin > 0 ? `a ${dec(s2.minMargin * 100, 1)}% margin (your plan's)` : "a profit"}; the batch counts what each costs there${s2.batch.aboveAsk > 0.5 ? ` (+${coins(s2.batch.aboveAsk)} over the lowest ask)` : ""}.</span>`);
    if (s2.limitedByListing) {
      const input = s2.inputs.find((i) => i.itemHrid === s2.limitedByListing);
      lines.push(`<span class="mwia-warn">Only the lowest ask of ${esc(itemName(input.itemHrid))} +${input.enhancementLevel} is known, so one listed is counted \u2013 open it on the market (\u{1F3EA}) to see how many are for sale.</span>`);
    }
    if (s2.limitedByBook) {
      const input = s2.inputs.find((i) => i.itemHrid === s2.limitedByBook);
      lines.push(`<span class="mwia-warn">Capped at the ${esc(itemName(input.itemHrid))} you can get: ${input.nearAsks.toLocaleString("en-US")} listed at \u2264 ${coins(input.maxPrice)} ${ago(input.bookAt)} ago${have(input.itemHrid) ? `, plus ${have(input.itemHrid).toLocaleString("en-US")} you have` : ""}.</span>`);
    }
    if (s2.bookAt) {
      const age = ago(s2.bookAt);
      const seen = [s2.profitableBids !== null && `${s2.profitableBids.toLocaleString("en-US")} in buy orders at \u2265 ${coins(s2.breakEven)} (break-even)`, s2.nearAsks !== null && `${s2.nearAsks.toLocaleString("en-US")} listed by others within ${dec(ASK_WINDOW * 100, 0)}% of the lowest ask`].filter(Boolean);
      if (seen.length) lines.push(`<span class="mwia-dim">On the market ${age} ago: ${seen.join(" \xB7 ")}.</span>`);
    }
    if (!s2.count) return lines.join("<br>") + (s2.heldOff ? " You already hold enough \u2013 nothing to make." : " Not enough coins for one.");
    lines.push(`\u2192 <b>${s2.verb || "make"} ${s2.count.toLocaleString("en-US")}</b> (${hoursText(s2.hours)}).`);
    const b = s2.batch;
    const owned = b.materials - b.toBuy;
    const heldText = b.heldSaving > 0.5 ? `; ${coins(owned)} worth is already in your inventory, counted at what it would sell for at the bid after tax \u2013 ${coins(b.heldSaving)} less than buying it` : `; ${coins(owned)} worth is already in your inventory`;
    lines.push(`<b>This batch:</b> materials ${coins(b.materials)}${owned > 1 ? ` (you buy ${coins(b.toBuy)}${heldText})` : ""}${b.teas > 1 ? `, teas ${coins(b.teas)}` : ""}.
        It sells for ${coins(b.revenue)} after tax \u2192 <b class="${b.profit >= 0 ? "mwia-ok" : "mwia-bad"}">${b.profit >= 0 ? "+" : "\u2212"}${coins(Math.abs(b.profit))}</b>.
        <span class="mwia-dim">The coins come back as the items sell, so a slow seller ties them up for a while.</span>`);
    return lines.join("<br>");
  }
  var INVENTORY2 = "/item_locations/inventory";
  function topActionHrid(settings2, skill) {
    if (!SKILLING_SKILLS.includes(skill) || !state.character) return null;
    return ranking({ ...settings2, skillingSkill: skill }).available.find((e2) => e2.valid && e2.goldPerDay > 0)?.hrid || null;
  }
  var topActionKey = (settings2) => [settings2.skillingSellAt, settings2.skillingTeas, planMode(settings2), goldShare(settings2), !!settings2.countLevels, historyVersion()].join("|");
  var topLevelingEntry = (settings2, skill) => ranking({ ...settings2, skillingSkill: skill }).available.find((e2) => e2.valid) || null;
  function upgradeRanking(settings2) {
    var _a;
    const skill = settings2.skillingSkill;
    const key2 = [state.updatedAt, pricesStamp(), skill, topActionKey(settings2)].join("|");
    if (view.upgradesKey !== key2) {
      const data = getClientData();
      const isLeveling = LEVELING_SKILLS.includes(skill);
      const top = isLeveling ? topLevelingEntry(settings2, skill) : null;
      const equipped = {};
      const owned = {};
      for (const item of state.items.values()) {
        if (!item.itemHrid) continue;
        if (item.itemLocationHrid === INVENTORY2) (owned[_a = item.itemHrid] || (owned[_a] = [])).push(item.enhancementLevel || 0);
        else equipped[item.itemLocationHrid] = { itemHrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 };
      }
      const houseLevels = {};
      for (const [hrid, room] of Object.entries(state.character.characterHouseRoomMap || {})) houseLevels[hrid] = room.level || 0;
      view.upgrades = rankUpgrades(skillingCharacter(state.character, state.items, data), data, skillingMarket(settings2.skillingSellAt), skill, {
        equipped,
        owned,
        listings: (hrid) => marketListings(hrid),
        bids: (hrid) => marketBids(hrid),
        houseLevels,
        gameEquipmentBuffs: state.character.equipmentActionTypeBuffsMap || null,
        actionHrid: isLeveling ? top?.hrid || null : topActionHrid(settings2, skill),
        leveling: isLeveling ? { ...levelingOptions(settings2, data), xpPrice: Math.max(0, top?.coinsPerXp ?? 0) } : {}
      });
      view.upgradesKey = key2;
    }
    return view.upgrades;
  }
  function upgradesHtml(settings2) {
    if (settings2.skillingSkill === "all") {
      return `<section><h3>Upgrades that pay back</h3><p class="mwia-dim">Pick a skill above to see which tools, clothes, jewellery and house rooms pay for themselves.</p></section>`;
    }
    const { base, upgrades, outlived = [], check, xpPrice } = upgradeRanking(settings2);
    const isLeveling = LEVELING_SKILLS.includes(settings2.skillingSkill);
    let html = `<section><h3>Upgrades that pay back</h3>`;
    if (!base) return html + `<p class="mwia-dim">${isLeveling ? "Nothing in the list above to measure on." : "Nothing in this skill earns gold at your level yet."}</p></section>`;
    if (isLeveling) {
      const repicked = settings2.skillingSkill === "enhancing" ? "the target is picked again with the upgrade" : "the catalyst is picked again with the upgrade";
      const xp = xpPrice > 0 ? `XP counts at the ${dec(xpPrice, 1)} coins per XP it costs there \u2013 what that XP would cost you otherwise \u2013 so an upgrade that only adds XP pays back too` : "It earns gold, so only the gold counts";
      html += `<p class="mwia-dim">Each tried in place of what you wear now, measured on the top of the list above (now ${esc(adviceName(base))}, ${coins(base.goldPerDay)}/day, ${coins(base.xpPerDay)} XP/day); ${repicked}. ${xp}. Payback = what it costs, less what it sells for again at the bid, \xF7 what it adds a day.</p>`;
    } else html += `<p class="mwia-dim">Each tried in place of what you wear now, measured on what you'd make: the top of the list above (now ${esc(base.action.name)}, ${coins(base.goldPerDay)}/day). Payback = what it costs, less what it sells for again at the bid, \xF7 extra gold a day. A +level's step shows what it adds over the next lower one for sale.</p>`;
    if (check && !check.matches) {
      html += `<div class="mwia-notice mwia-notice-warn">Your gear's action speed here is ${pct(check.game)} by the game but ${pct(check.mine)} by the item stats, so these numbers may be a little off.</div>`;
    }
    const later = outlivedHtml(outlived);
    if (!upgrades.length) return html + `<p class="mwia-dim">Nothing for sale would earn more here.</p>${later}</section>`;
    html += `<div class="mwia-upgrade-list">${upgrades.slice(0, UPGRADES_SHOWN).map((u) => upgradeRowHtml(u, xpPrice, base)).join("")}</div>${later}</section>`;
    return html;
  }
  function outlivedHtml(outlived) {
    const byTier = /* @__PURE__ */ new Map();
    for (const u of outlived) {
      if (!byTier.has(u.nextTier.itemHrid)) byTier.set(u.nextTier.itemHrid, { next: u.nextTier, items: [] });
      byTier.get(u.nextTier.itemHrid).items.push(u);
    }
    return [...byTier.values()].map(({ next, items }) => {
      const names2 = items.map((u) => `${esc(itemName(u.itemHrid))}${u.enhancementLevel ? ` +${u.enhancementLevel}` : ""}`).join(", ");
      return `<p class="mwia-dim">\u23F3 Left out: ${names2} \u2013 ${esc(itemName(next.itemHrid))} unlocks at level ${next.level} in about ${hoursText(next.days * 24)}, before ${items.length > 1 ? "they pay" : "it pays"} back. Wait for it.</p>`;
    }).join("");
  }
  function upgradeRowHtml(u, xpPrice = 0, base = null) {
    const payback = u.paybackDays === null ? "price unknown" : u.paybackDays === 0 ? u.owned ? "free \u2013 you own it" : "sells again for what it costs" : `pays back in ${hoursText(u.paybackDays * 24)}`;
    const gain = xpPrice > 0 ? levelingGainText(u, base) : `+${coins(u.gainPerDay)}/day${u.xpPerDay > 1 ? `, +${coins(u.xpPerDay)} XP/day` : ""}`;
    if (u.kind === "house") {
      const cart2 = u.materials.filter((m2) => m2.itemHrid !== "/items/coin").map((m2) => ({ hrid: m2.itemHrid, quantity: m2.count }));
      const coinsNeeded = u.materials.find((m2) => m2.itemHrid === "/items/coin")?.count || 0;
      return `<div class="mwia-upgrade"><div><b>\u{1F3E0} ${esc(u.name)} \u2192 level ${u.level}</b> <span class="mwia-dim">${u.price === null ? "" : coins(u.price)}</span>
            <small>${gain} \xB7 ${payback}${coinsNeeded ? ` \xB7 incl. ${coins(coinsNeeded)} coins` : ""}</small></div>
            ${cart2.length ? `<button class="mwia-cart-btn" data-action="skilling-cart" data-teas="${esc(JSON.stringify(cart2))}" title="Adds the materials to the MWITools cart">\u{1F6D2} Materials</button>` : ""}</div>`;
    }
    const name = `${esc(itemName(u.itemHrid))}${u.enhancementLevel ? ` <span class="mwia-enh">+${u.enhancementLevel}</span>` : ""}`;
    const replaces = u.replaces ? `replaces ${esc(itemName(u.replaces.itemHrid))}${u.replaces.enhancementLevel ? ` +${u.replaces.enhancementLevel}` : ""}` : "empty slot";
    const cart = u.owned ? "" : `<button class="mwia-cart-btn" data-action="skilling-cart" data-teas="${esc(JSON.stringify([{ hrid: u.itemHrid, quantity: 1, enhancementLevel: u.enhancementLevel }]))}" title="Adds it to the MWITools cart">\u{1F6D2} Add</button>`;
    const resale = !u.owned && u.resale > 1 ? ` <span class="mwia-dim">(${resaleText(u)})</span>` : "";
    const st = u.step;
    const step = st ? `<small class="mwia-dim">+${st.from} \u2192 +${u.enhancementLevel}: ${st.price >= 0 ? "+" : "\u2212"}${coins(Math.abs(st.price))} for +${coins(st.gainPerDay)}/day${st.paybackDays === null ? " \u2013 adds nothing" : st.paybackDays === 0 ? " \u2013 no extra cost after resale" : ` \u2013 the step pays back in ${hoursText(st.paybackDays * 24)}`}</small>` : "";
    return `<div class="mwia-upgrade"><div><b>${name}</b> <span class="mwia-dim">${u.owned ? "you own it" : coins(u.price)}</span>${resale}
        <small>${gain} \xB7 ${payback} \xB7 ${replaces}${slotsText(u)}</small>${step}</div>${cart}</div>`;
  }
  function levelingGainText(u, base) {
    const gold = Math.abs(u.goldPerDay) >= 1 ? `${u.goldPerDay >= 0 ? "+" : "\u2212"}${coins(Math.abs(u.goldPerDay))} gold` : null;
    const xp = Math.abs(u.xpPerDay) >= 1 ? `${u.xpPerDay >= 0 ? "+" : "\u2212"}${coins(Math.abs(u.xpPerDay))} XP` : null;
    const target = u.target && base?.target && u.target !== base.target ? `, then to +${u.target}` : "";
    return `worth +${coins(u.gainPerDay)}/day (${[gold, xp].filter(Boolean).join(", ") || "a little"}${target})`;
  }
  function resaleText(u) {
    if (u.resaleLevel === u.enhancementLevel) return `${coins(u.resale)} back when sold`;
    const none = `nobody buys${u.enhancementLevel ? ` +${u.enhancementLevel}` : " it"}`;
    if (u.resaleLevel === null) return `${coins(u.resale)} back at the shop: ${none}`;
    return `\u2265 ${coins(u.resale)} back: ${none}, so +${u.resaleLevel}'s bid \u2013 list it to sell`;
  }
  function slotsText(u) {
    if (!u.extraSlots) return "";
    const slots = `${u.extraSlots > 0 ? "+" : ""}${u.extraSlots} tea slot${Math.abs(u.extraSlots) === 1 ? "" : "s"}`;
    return ` \xB7 ${slots}${u.teas?.length ? ` (with ${esc(names(u.teas))} on ${esc(u.bestAction.name)})` : ""}`;
  }
  function skillingExportLines(settings2, count3 = 10) {
    const { available } = ranking(settings2);
    const mode = PLAN_MODES[planMode(settings2)];
    const n5 = (x) => Math.round(x).toLocaleString("en-US");
    const lines = [`Skill ${settings2.skillingSkill} \xB7 sell at ${settings2.skillingSellAt} \xB7 teas ${settings2.skillingTeas} \xB7 plan ${planMode(settings2)} (${hoursText(mode.hours)}) \xB7 focus ${goldShare(settings2)}% gold${settings2.countLevels ? " \xB7 counting levels" : ""}`];
    available.filter((e2) => e2.valid).slice(0, count3).forEach((e2, i) => {
      const fill = e2.fill ?? 1;
      const head4 = `${i + 1}. ${adviceName(e2)} \u2013 ${skillLabel(skillOf(e2))} ${e2.action.levelRequirement.level} \xB7 ranked on ${coins(e2.goldPerDay * fill)}/day${fill < 1 ? ` (${coins(e2.goldPerDay)}/day running all ${hoursText(mode.hours)}, the job fills ${Math.round(fill * 100)}%)` : ""} \xB7 ${coins(e2.xpPerDay * fill)} XP/day \xB7 score ${dec(e2.score, 3)}`;
      const parts = [`${dec(e2.actionsPerHour, 0)} actions/h`, `profit ${coins(e2.profitPerHour)}/h`, `margin ${dec((e2.margin || 0) * 100, 1)}%`];
      if (e2.teas?.length) parts.push(`teas ${e2.teas.map(itemName).join(", ")}`);
      if (e2.inputs?.length) parts.push(`buys ${e2.inputs.map((input) => `${dec(input.count, 2)} ${itemName(input.itemHrid)} @ ${coins(input.price || 0)}`).join(" + ")} per action`);
      const out = e2.outputs?.find((o2) => o2.kind === "product");
      if (out) parts.push(`sells ${dec(out.count, 2)} ${itemName(out.itemHrid)} @ ${coins(out.price ?? out.value ?? 0)} after tax`);
      const lines2 = [head4, `   ${parts.join(" \xB7 ")}`];
      const s2 = e2.suggestion;
      if (s2?.known) {
        const sold = s2.productLiquidity.sold?.enough ? `~${n5(s2.productLiquidity.sold.perDay)} sold/day` : "sales unknown";
        const job = [
          `make ${n5(s2.count)} (${hoursText(s2.hours)} of ${hoursText(s2.plannedHours)}${s2.short ? `, cut by ${s2.short}` : ""})`,
          `market ${s2.liquidity.rating}${s2.ratedBy ? ` (set by ${itemName(s2.ratedBy)})` : ""}, product ${s2.productLiquidity.rating}, ${sold}`,
          `you hold ${n5(s2.held)} (${n5(s2.stock.inventory)} inventory, ${n5(s2.stock.listed)} listed)${s2.heldOff ? `, ${n5(s2.heldOff)} taken off the job` : ""}`,
          `coins for materials ${coins(s2.budget)} (${Math.round(s2.coinShare * 100)}%)${s2.limitedByCoins ? " \u2013 the cap" : ""}`,
          `batch materials ${coins(s2.batch.materials)} (buy ${coins(s2.batch.toBuy)}), sells ${coins(s2.batch.revenue)}, profit ${coins(s2.batch.profit)}`
        ];
        if (s2.swing && s2.swing.share < 1) job.push(`made ${Math.round(s2.swing.share * 100)}% for the price swing (\xB1${dec(s2.swing.swing * 100, 1)}%)`);
        if (s2.limitedByBook) job.push(`${itemName(s2.limitedByBook)} listed while the margin holds caps it`);
        lines2.push(`   ${job.join(" \xB7 ")}`);
      } else if (e2.budget) {
        lines2.push(`   coins last ${hoursText(e2.budget.hours)} of ${hoursText(e2.budget.plannedHours)} \xB7 budget ${coins(e2.budget.budget)} (${Math.round(e2.budget.share * 100)}%)`);
      }
      const warnings = e2.warnings.map(warningText).filter(Boolean);
      if (warnings.length) lines2.push(`   \u26A0 ${warnings.join(" ")}`);
      lines.push(...lines2);
    });
    return lines;
  }

  // src/game-nav.js
  var NAV_LINK = '[class*="NavigationBar_navigationLink"]';
  var ACTION_CARD = '[class*="SkillAction_skillAction"]';
  var ACTION_CARD_NAME = '[class*="SkillAction_name"]';
  var PANEL = 'div[class*="SkillActionDetail_regularComponent"],div[class*="SkillActionDetail_skillActionDetail"]';
  var PANEL_NAME = 'div[class*="SkillActionDetail_name"]';
  var COUNT_INPUT = 'div[class*="SkillActionDetail_maxActionCountInput"] input';
  var BUTTONS = '[class*="SkillActionDetail_buttonsContainer"]';
  var TABS = '[role="tab"],[class*="TabsComponent_tab"],[class*="Tab_tab"]';
  var NAV_HANDLERS = [
    "handleGoToActionTypeDetail",
    "handleClickActionTypeDetail",
    "handleGoToActionType",
    "handleSelectActionType",
    "handleGoToActionDetail",
    "handleSelectAction",
    "handleClickAction",
    "handleGoToAction"
  ];
  var lastDiagnostics = "";
  var pageWindow = window;
  function usePageWindow(win2) {
    pageWindow = win2 || window;
  }
  var attempt = (read, fallback = null) => {
    try {
      return read();
    } catch {
      return fallback;
    }
  };
  var pageDocument = () => attempt(() => pageWindow.document) || document;
  var pageView = (node) => attempt(() => node?.wrappedJSObject) || node;
  var REACT_KEY = /^__react(Container|Fiber|InternalInstance)\$/;
  var reactKeys = (node) => attempt(() => Object.getOwnPropertyNames(node).filter((k) => REACT_KEY.test(k)), []);
  function worldReport() {
    const info = attempt(() => typeof GM_info !== "undefined" ? GM_info : null);
    const root = document.getElementById("root");
    const doc = pageDocument();
    const pageRoot = doc !== document ? attempt(() => doc.getElementById("root")) : null;
    const wrapped = attempt(() => root?.wrappedJSObject);
    return [
      `${info?.scriptHandler || "manager ?"} ${info?.version || ""} inject ${info?.injectInto || "?"}`.replace(/\s+/g, " "),
      `window ${pageWindow === window ? "own" : "page's"}`,
      `document ${doc === document ? "own" : "page's"}`,
      `#root ${root ? `found, react keys ${reactKeys(root).length}` : "missing"}`,
      pageRoot ? `page #root react keys ${reactKeys(pageRoot).length}` : "",
      wrapped ? `wrapped #root react keys ${reactKeys(wrapped).length}` : "",
      `MWITools ${attempt(() => !!pageWindow.MWITools, "?")}`,
      reactScan(root)
    ].filter(Boolean).join(", ");
  }
  function reactScan(root) {
    const own = (node) => attempt(() => Object.getOwnPropertyNames(node), []).filter((k) => k.startsWith("_"));
    const prefix = (key2) => key2.replace(/\$.*$/, "$");
    const parts = [`#root own: ${own(root).map(prefix).join(" ") || "none"}, children ${root?.children.length ?? "\u2013"}`];
    const found = [];
    const other = /* @__PURE__ */ new Set();
    for (const node of [...document.querySelectorAll("body *")].slice(0, 5e3)) {
      const keys = own(node);
      if (keys.some((k) => k.startsWith("__react"))) {
        if (found.length < 2) found.push(`${describe(node)} [${[...new Set(keys.map(prefix))].join(" ")}]`);
      } else keys.forEach((k) => other.size < 6 && other.add(prefix(k)));
    }
    parts.push(found.length ? `react on ${found.join("; ")}` : "no element with __react keys");
    if (other.size) parts.push(`other keys ${[...other].join(" ")}`);
    return parts.join(", ");
  }
  function navDiagnostics() {
    return lastDiagnostics;
  }
  var sleep = (ms) => new Promise((resolve2) => setTimeout(resolve2, ms));
  var clean = (text) => String(text || "").replace(/\s+/g, " ").trim();
  function visible(element) {
    if (!element?.isConnected || element.hidden) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }
  var iconHref = (use) => use.getAttribute("href") || use.getAttribute("xlink:href") || "";
  function iconIds(element) {
    return [...element.querySelectorAll("use")].map((use) => iconHref(use).split("#")[1] || "");
  }
  function describe(element) {
    const classes = String(element.className?.baseVal ?? element.className ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return [element.tagName.toLowerCase(), ...classes].join(".");
  }
  function navReport(skill) {
    const links = [...document.querySelectorAll(NAV_LINK)];
    const parts = [`nav links: ${links.length} (${links.filter(visible).length} visible)`];
    if (links.length) parts.push("icons: " + links.map((link) => iconIds(link).join("+") || "?").join(","));
    const icons = [...document.querySelectorAll("use")].filter((use) => iconHref(use).endsWith("#" + skill));
    if (icons.length) {
      const chain = [];
      for (let node = icons[0].parentElement; node && node !== document.body && chain.length < 6; node = node.parentElement) chain.push(describe(node));
      parts.push(`#${skill} icons: ${icons.length}, first ${iconHref(icons[0])} in ${chain.join(" < ")}`);
    } else parts.push(`no #${skill} icon on page`);
    return parts;
  }
  function screenReport(categoryName) {
    const cards = [...document.querySelectorAll(ACTION_CARD)].filter(visible);
    const tabs = [...document.querySelectorAll(TABS)].filter(visible).map((tab) => clean(tab.textContent));
    return [
      `cards: ${cards.length}` + (cards.length ? " (" + cards.slice(0, 6).map((card) => clean(card.querySelector(ACTION_CARD_NAME)?.textContent) || "?").join(", ") + ")" : ""),
      `tabs: ${tabs.length}` + (tabs.length ? " (" + tabs.slice(0, 10).join(", ") + ")" : ""),
      `tab "${categoryName}": ${tabs.includes(categoryName) ? "found" : "missing"}`,
      `panel names: ${[...document.querySelectorAll(PANEL_NAME)].filter(visible).map((name) => clean(name.textContent)).join(", ") || "none"}`
    ];
  }
  function findActionPanel(actionName2) {
    for (const name of document.querySelectorAll(PANEL_NAME)) {
      if (!visible(name) || clean(name.textContent) !== actionName2) continue;
      const panel = name.closest(PANEL) || name.parentElement;
      const input = panel?.querySelector(COUNT_INPUT);
      if (input) return { panel, input, buttons: panel.querySelector(BUTTONS) };
    }
    return null;
  }
  function openActionPanels() {
    const panels = [];
    for (const name of document.querySelectorAll(PANEL_NAME)) {
      if (!visible(name)) continue;
      const panel = name.closest(PANEL) || name.parentElement;
      if (panel) panels.push({ panel, name: clean(name.textContent), buttons: panel.querySelector(BUTTONS) });
    }
    return panels;
  }
  function setReactInput(input, value) {
    const previous = input.value;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
    if (setter) setter.call(input, String(value));
    else input.value = String(value);
    input._valueTracker?.setValue(previous);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function clickCard(action, itemId) {
    const card = [...document.querySelectorAll(ACTION_CARD)].filter(visible).find((candidate) => {
      const name = clean(candidate.querySelector(ACTION_CARD_NAME)?.textContent);
      return name === action.name || itemId && iconIds(candidate).includes(itemId);
    });
    card?.click();
    return !!card;
  }
  function clickTab(label3) {
    if (!label3) return false;
    const tab = [...document.querySelectorAll(TABS)].filter(visible).find((candidate) => clean(candidate.textContent) === label3);
    if (!tab) return false;
    if (tab.getAttribute("aria-selected") !== "true") tab.click();
    return true;
  }
  function clickSkill(skill) {
    const link = [...document.querySelectorAll(NAV_LINK)].find((candidate) => !candidate.querySelector(NAV_LINK) && iconIds(candidate).includes(skill));
    link?.click();
    return link || null;
  }
  function callGameHandler(win2, actionHrid) {
    return callReactHandler(NAV_HANDLERS, [actionHrid]);
  }
  function rootFibers() {
    for (const doc of [.../* @__PURE__ */ new Set([document, pageDocument()])]) {
      const fibers = [];
      for (const found of [doc.getElementById("root"), doc.querySelector('[class*="GamePage_gamePage"]')]) {
        const element = pageView(found);
        for (const key2 of reactKeys(element)) fibers.push(element[key2]?.current ?? element[key2]);
        const legacy = attempt(() => element?._reactRootContainer);
        const current = legacy?.current ?? legacy?._internalRoot?.current;
        if (current) fibers.push(current);
      }
      if (fibers.length) return fibers;
    }
    return [];
  }
  function walkFibers(found) {
    const fibers = rootFibers();
    const roots = fibers.length;
    const visited = /* @__PURE__ */ new Set();
    while (fibers.length && visited.size < 5e4) {
      const fiber = fibers.pop();
      if (!fiber || visited.has(fiber)) continue;
      visited.add(fiber);
      if (found(fiber)) return { fiber, roots, seen: visited.size };
      if (fiber.return) fibers.push(fiber.return);
      if (fiber.child) fibers.push(fiber.child);
      if (fiber.sibling) fibers.push(fiber.sibling);
    }
    return { fiber: null, roots, seen: visited.size };
  }
  function callReactHandler(names2, args) {
    let called = null;
    const { fiber, roots, seen } = walkFibers((f) => {
      const instance = f.stateNode;
      for (const handler of names2) {
        if (instance && typeof instance[handler] === "function") {
          try {
            instance[handler](...args);
            called = handler;
            return true;
          } catch {
          }
        }
      }
      return false;
    });
    if (fiber) return `react: ${called} called`;
    return `react: no handler (roots ${roots}, fibers ${seen}; ${worldReport()})`;
  }
  async function openAction(win2, action, data, timeoutMs = 4e3) {
    lastDiagnostics = "";
    if (findActionPanel(action.name)) return true;
    const itemId = action.outputItems?.[0]?.itemHrid?.split("/").pop();
    const skill = action.type.split("/").pop();
    const categoryName = data.actionCategoryDetailMap?.[action.category]?.name;
    const report = [];
    if (!clickCard(action, itemId)) {
      const link = clickSkill(skill);
      report.push(...navReport(skill), link ? `clicked ${describe(link)}` : `no nav link with #${skill}`);
      const deadline2 = Date.now() + timeoutMs;
      let clicked = false;
      while (!clicked && Date.now() < deadline2) {
        await sleep(120);
        clicked = clickCard(action, itemId) || clickTab(categoryName) && (await sleep(120), clickCard(action, itemId));
      }
      if (!clicked) report.push(...screenReport(categoryName), callGameHandler(win2, action.hrid));
    } else report.push("card was on screen and clicked");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (findActionPanel(action.name)) return true;
      await sleep(100);
    }
    report.push(`no panel for "${action.name}"`);
    lastDiagnostics = report.join(" \xB7 ");
    return false;
  }
  var ENHANCING_PANEL = '[class*="SkillActionDetail_enhancingComponent"]';
  var ALCHEMY_PANEL = '[class*="SkillActionDetail_alchemyComponent"]';
  var inventoryItemHash = (characterId4, itemHrid, level = 0) => `${characterId4}::/item_locations/inventory::${itemHrid}::${level}`;
  function componentWith(element, method) {
    const nodes = element ? [element, ...element.querySelectorAll("input, button, select")].map(pageView) : [];
    const upFrom = (start2) => {
      for (let fiber = start2, steps = 0; fiber && steps < 60; fiber = fiber.return, steps++) {
        if (typeof fiber.stateNode?.[method] === "function") return fiber.stateNode;
      }
      return null;
    };
    for (const node of nodes) {
      const key2 = reactKeys(node).find((k) => !k.startsWith("__reactContainer"));
      const found = key2 && upFrom(node[key2]);
      if (found) return found;
    }
    if (!nodes.length) return null;
    const hosts = new Set(nodes);
    return upFrom(walkFibers((f) => hosts.has(f.stateNode)).fiber);
  }
  async function waitFor(find, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    for (; ; ) {
      const found = find();
      if (found || Date.now() > deadline) return found || null;
      await sleep(100);
    }
  }
  var visiblePanel = (selector) => [...pageDocument().querySelectorAll(selector)].find(visible) || null;
  function levelingPanels() {
    const out = [];
    for (const [kind, selector, method] of [["enhancing", ENHANCING_PANEL, "enhancingMaxLevelChanged"], ["alchemy", ALCHEMY_PANEL, "selectAlchemyItemHandler"]]) {
      for (const panel of pageDocument().querySelectorAll(selector)) {
        if (!visible(panel)) continue;
        const held = componentWith(panel, method)?.state || {};
        const tab = kind === "alchemy" ? [...document.querySelectorAll(TABS)].find((t4) => visible(t4) && t4.getAttribute("aria-selected") === "true" && /^(Coinify|Decompose|Transmute)$/.test(clean(t4.textContent))) : null;
        out.push({ panel, kind, itemHash: held.primaryItemHash || null, target: held.enhancingMaxLevel ?? null, tab: tab ? clean(tab.textContent) : null, buttons: panel.querySelector(BUTTONS) });
      }
    }
    return out;
  }
  var SKIP_METHOD = /^(render|constructor|setState|forceUpdate|component|getSnapshot|shouldComponent|UNSAFE_|isReact)|remove|clear|delete|reset/i;
  function componentMethods(component) {
    const names2 = /* @__PURE__ */ new Set();
    for (let o2 = component; o2 && o2 !== Object.prototype; o2 = Object.getPrototypeOf(o2)) {
      for (const name of attempt(() => Object.getOwnPropertyNames(o2), [])) {
        if (!SKIP_METHOD.test(name) && attempt(() => typeof component[name] === "function", false)) names2.add(name);
      }
    }
    return [...names2];
  }
  var findMethod = (component, ...patterns) => componentMethods(component).find((name) => patterns.every((p2) => p2.test(name))) || null;
  var holds = (component, value) => attempt(() => Object.values(component.state || {}).some((v) => v === value || String(v) === String(value)), false);
  var methodList = (component) => `methods: ${componentMethods(component).slice(0, 40).join(", ") || "none"}`;
  async function fillSlot(component, word, label3, hash2) {
    if (!hash2) return { ok: false, step: `${label3} not in the inventory at +0 \u2013 buy it (\u{1F6D2})` };
    const method = findMethod(component, word, /^(select|set|change|handle|on)/i, /item|hash|select/i) || findMethod(component, word, /^(select|set|change)/i);
    if (!method) return { ok: false, step: `no ${label3} method (${methodList(component)})` };
    attempt(() => component[method](hash2));
    await sleep(200);
    const ok = holds(component, hash2);
    return { ok, step: `${label3}: ${method} called${ok ? "" : ` but not in the slot (${methodList(component)})`}` };
  }
  async function openEnhancing(itemHash, target, protect = null, timeoutMs = 4e3) {
    const steps = [];
    const done2 = (result) => (lastDiagnostics = steps.join(" \xB7 "), result);
    const called = itemHash ? callReactHandler(["handleEnhanceItem"], [itemHash]) : "no item";
    steps.push(called);
    if (!/called/.test(called)) {
      const link = clickSkill("enhancing");
      steps.push(link ? `opened the Enhancing page (${describe(link)})` : "no Enhancing link");
      return done2(link ? "page" : false);
    }
    const panel = await waitFor(() => visiblePanel(ENHANCING_PANEL), timeoutMs);
    steps.push(panel ? "enhancing panel" : "no enhancing panel");
    const component = panel && await waitFor(() => componentWith(panel, "enhancingMaxLevelChanged"), timeoutMs);
    if (!component) {
      if (panel) steps.push("without its component");
      return done2(panel ? "page" : false);
    }
    steps.push(`slot held ${component.state?.primaryItemHash ? "an item" : "nothing"}`);
    if (component.state?.primaryItemHash !== itemHash && typeof component.selectEnhancingItemHandler === "function") component.selectEnhancingItemHandler(itemHash);
    await sleep(150);
    return done2(await fillEnhancing(component, target, protect, steps));
  }
  async function fillEnhancing(component, target, protect, steps) {
    component.enhancingMaxLevelChanged({ target: { value: String(target) } });
    steps.push(`target +${target} set`);
    if (!protect) return "item";
    await sleep(150);
    const slot = await fillSlot(component, /protect/i, "protection", protect.hash);
    steps.push(slot.step);
    const levelMethod = findMethod(component, /protect/i, /level/i, /change|set/i);
    if (levelMethod) attempt(() => component[levelMethod]({ target: { value: String(protect.from) } }));
    await sleep(200);
    const levelSet = levelMethod && holds(component, protect.from);
    steps.push(levelMethod ? `protect from +${protect.from}: ${levelMethod} called${levelSet ? "" : " but not set"}` : `no protect-level method (${methodList(component)})`);
    return slot.ok && levelSet ? "item" : "partial";
  }
  async function setEnhancing(panel, target, protect = null) {
    const steps = [];
    const component = componentWith(panel, "enhancingMaxLevelChanged");
    if (!component) {
      lastDiagnostics = "no enhancing component";
      return false;
    }
    const result = await fillEnhancing(component, target, protect, steps);
    lastDiagnostics = steps.join(" \xB7 ");
    return result;
  }
  async function openAlchemy(itemHash, tabLabel, count3, catalyst = null, timeoutMs = 4e3) {
    const steps = [];
    const done2 = (result) => (lastDiagnostics = steps.join(" \xB7 "), result);
    const called = itemHash ? callReactHandler(["handleAlchemizeItem"], [itemHash]) : "no item";
    steps.push(called);
    if (!/called/.test(called)) {
      const link = clickSkill("alchemy");
      const tab = link && await waitFor(() => clickTab(tabLabel), timeoutMs);
      steps.push(link ? `opened the Alchemy page (${describe(link)})` : "no Alchemy link");
      if (link) steps.push(tab ? `${tabLabel} tab` : `no ${tabLabel} tab`);
      return done2(link ? "page" : false);
    }
    steps.push(await waitFor(() => visiblePanel(ALCHEMY_PANEL), timeoutMs) ? "alchemy panel" : "no alchemy panel yet");
    await sleep(300);
    const selected = () => [...document.querySelectorAll(TABS)].some((tab) => visible(tab) && clean(tab.textContent) === tabLabel && tab.getAttribute("aria-selected") === "true");
    steps.push(await waitFor(() => (clickTab(tabLabel), selected()), timeoutMs) ? `${tabLabel} tab` : `no ${tabLabel} tab`);
    await sleep(150);
    const panel = await waitFor(() => visiblePanel(ALCHEMY_PANEL), timeoutMs);
    const component = panel && await waitFor(() => componentWith(panel, "selectAlchemyItemHandler"), timeoutMs);
    if (!component) {
      steps.push(panel ? "alchemy panel without its component" : "no alchemy panel");
      return done2(panel ? "page" : false);
    }
    steps.push(`slot held ${component.state?.primaryItemHash ? "an item" : "nothing"}`);
    if (component.state?.primaryItemHash !== itemHash) component.selectAlchemyItemHandler(itemHash);
    await sleep(150);
    if (count3 > 0 && typeof component.maxActionCountChanged === "function") component.maxActionCountChanged({ target: { value: String(count3) } });
    steps.push(count3 > 0 ? typeof component.maxActionCountChanged === "function" ? `count ${count3} set` : "no count box" : "no count");
    if (!catalyst) return done2("item");
    await sleep(150);
    const slot = await fillSlot(component, /catalyst/i, "catalyst", catalyst.hash);
    steps.push(slot.step);
    return done2(slot.ok ? "item" : "partial");
  }
  function openMarketplace(win2, itemHrid, level = 0) {
    try {
      const api = win2.MWITools?.shopping;
      if (typeof api?.openMarketplace === "function" && api.openMarketplace(itemHrid, level)) return true;
    } catch {
    }
    return /called/.test(callReactHandler(["handleGoToMarketplace"], [itemHrid, level]));
  }

  // src/job-ledger.js
  var MAX_REPORTS = 60;
  var MAX_HISTORY = 1e3;
  var LOT_MS = 30 * 24 * 3600 * 1e3;
  var INSTANT_MS = 2 * 60 * 1e3;
  var COIN5 = "/items/coin";
  var keyOf = (hrid, level = 0) => `${hrid}::${Number(level) || 0}`;
  function splitKey(key2) {
    const i = key2.lastIndexOf("::");
    return { itemHrid: key2.slice(0, i), level: Number(key2.slice(i + 2)) || 0 };
  }
  function emptyLedger(now2 = Date.now()) {
    return { since: now2, purchases: {}, fills: {}, forecasts: {}, reports: {}, history: {}, unsent: { reports: [], purchases: [] }, piSeq: 0 };
  }
  function runningAction(actions) {
    const a = (actions || []).find((x) => !x.isDone);
    return a && !String(a.actionHrid || "").startsWith("/actions/combat/") ? a : null;
  }
  var mark = (list, id) => {
    if (!list.includes(id)) list.push(id);
  };
  function noteFills(ledger, listings, { now: now2, live, bookOf = () => null }) {
    let changed2 = false;
    for (const listing of listings || []) {
      if (!listing || listing.isSell) continue;
      const id = String(listing.id);
      const filled = Number(listing.filledQuantity) || 0;
      const seen = ledger.fills[id];
      const bought = ledger.purchases[id];
      const prev = Math.max(seen?.filled ?? 0, bought?.filled ?? 0);
      const firstSeen = seen?.seen ?? (live && now2 - ledger.since > INSTANT_MS ? now2 : 0);
      if (filled > prev) {
        const price = Number(listing.price) || 0;
        const level = Number(listing.enhancementLevel) || 0;
        const qty2 = filled - prev;
        let cost = qty2 * price;
        let estimate = false;
        if (firstSeen && now2 - firstSeen <= INSTANT_MS) {
          const asks = (bookOf(listing.itemHrid, level) || []).filter((o2) => o2.price > 0 && o2.price <= price).sort((a, b) => a.price - b.price);
          let skip = prev;
          let left = qty2;
          let sum = 0;
          for (const o2 of asks) {
            let q = o2.quantity;
            const s2 = Math.min(skip, q);
            skip -= s2;
            q -= s2;
            const take = Math.min(left, q);
            sum += take * o2.price;
            left -= take;
            if (left <= 0) break;
          }
          if (left < qty2) {
            cost = sum + left * price;
            estimate = true;
          }
        }
        ledger.purchases[id] = { key: keyOf(listing.itemHrid, level), filled, cost: (bought?.cost ?? 0) + cost, at: bought?.at ?? now2, timed: bought ? !!bought.timed : !!live, estimate: !!bought?.estimate || estimate };
        mark(ledger.unsent.purchases, id);
        changed2 = true;
      }
      ledger.fills[id] = { filled: Math.max(filled, prev), seen: firstSeen, at: now2 };
    }
    prune(ledger, now2);
    return changed2;
  }
  function prune(ledger, now2) {
    for (const [id, f] of Object.entries(ledger.fills)) if (now2 - f.at > LOT_MS) delete ledger.fills[id];
    for (const [id, b] of Object.entries(ledger.purchases)) if (now2 - b.at > LOT_MS) delete ledger.purchases[id];
  }
  function lotsLeft(ledger, except = null) {
    const lots = Object.values(ledger.purchases).filter((b) => b.filled > 0).map((b) => ({ key: b.key, qty: b.filled, left: b.filled, unit: b.cost / b.filled, at: b.at, timed: !!b.timed, estimate: !!b.estimate })).sort((a, b) => a.at - b.at);
    const results = Object.entries(ledger.history).filter(([key2]) => key2 !== except).map(([, h3]) => h3).sort((a, b) => a.endedAt - b.endedAt);
    for (const h3 of results) for (const [key2, qty2] of h3.used || []) takeLots(lots, key2, qty2, h3.endedAt);
    return lots;
  }
  function takeLots(lots, key2, qty2, by = Infinity) {
    let left = qty2;
    let cost = 0;
    let estimate = false;
    for (const lot of lots) {
      if (lot.key !== key2 || lot.left <= 1e-9 || lot.timed && lot.at > by) continue;
      const take = Math.min(left, lot.left);
      lot.left -= take;
      left -= take;
      cost += take * lot.unit;
      estimate || (estimate = lot.estimate);
      if (left <= 1e-9) break;
    }
    return { qty: qty2 - Math.max(0, left), cost, estimate };
  }
  var jobGroup = (actionHrid, item) => String(actionHrid).startsWith("/actions/alchemy/") ? `${actionHrid}#${item}` : actionHrid;
  function summarize2(r) {
    return {
      group: jobGroup(r.actionHrid, r.item),
      name: r.name,
      endedAt: r.endedAt,
      hours: r.hours,
      actions: r.actions,
      revenue: r.revenue,
      profit: r.profit,
      expectedMargin: r.forecast?.margin ?? null,
      used: r.used.filter((u) => u.itemHrid !== COIN5).map((u) => [keyOf(u.itemHrid, u.level), u.qty])
    };
  }
  function keepReport(ledger, key2, report, { sent = false } = {}) {
    ledger.reports[key2] = report;
    ledger.history[key2] = summarize2(report);
    if (!sent) mark(ledger.unsent.reports, key2);
    const full = Object.keys(ledger.reports).sort((a, b) => ledger.reports[a].endedAt - ledger.reports[b].endedAt);
    for (const k of full.slice(0, Math.max(0, full.length - MAX_REPORTS))) delete ledger.reports[k];
    const all = Object.keys(ledger.history).sort((a, b) => ledger.history[a].endedAt - ledger.history[b].endedAt);
    for (const k of all.slice(0, Math.max(0, all.length - MAX_HISTORY))) delete ledger.history[k];
  }
  var newerReport = (incoming, kept2) => !kept2 || incoming.actions > kept2.actions || incoming.endedAt > kept2.endedAt;
  function mergeFromPi2(ledger, wire) {
    let changed2 = false;
    for (const { key: key2, report } of wire.reports || []) {
      if (!key2 || !report || !Number.isFinite(report.endedAt)) continue;
      if (newerReport(report, ledger.history[key2])) {
        keepReport(ledger, key2, report, { sent: true });
        changed2 = true;
      }
    }
    for (const { uid, purchase } of wire.purchases || []) {
      if (!uid || !purchase || !(purchase.filled > 0)) continue;
      const mine2 = ledger.purchases[uid];
      if (!mine2 || purchase.filled > mine2.filled) {
        ledger.purchases[uid] = { key: purchase.key, filled: purchase.filled, cost: purchase.cost, at: purchase.at, timed: !!purchase.timed, estimate: !!purchase.estimate };
        changed2 = true;
      }
    }
    if (Number.isFinite(wire.seq)) ledger.piSeq = Math.max(ledger.piSeq || 0, wire.seq);
    return changed2;
  }
  function unsentForPi(ledger) {
    return {
      reports: ledger.unsent.reports.filter((k) => ledger.reports[k]).map((key2) => ({ key: key2, report: ledger.reports[key2] })),
      purchases: ledger.unsent.purchases.filter((id) => ledger.purchases[id]).map((uid) => ({ uid, purchase: ledger.purchases[uid] }))
    };
  }
  function markSent(ledger, { reports = [], purchases = [] }) {
    ledger.unsent.reports = ledger.unsent.reports.filter((k) => !reports.includes(k) && ledger.reports[k]);
    ledger.unsent.purchases = ledger.unsent.purchases.filter((id) => !purchases.includes(id) && ledger.purchases[id]);
  }
  function groupHistory(ledger, group, except = null) {
    const list = Object.entries(ledger.history).filter(([key2, h3]) => key2 !== except && h3.group === group).map(([, h3]) => h3);
    if (!list.length) return null;
    const sum = (f) => list.reduce((s2, h3) => s2 + (f(h3) || 0), 0);
    const revenue = sum((h3) => h3.revenue);
    const hours = sum((h3) => h3.hours);
    const profit = sum((h3) => h3.profit);
    const expected = list.filter((h3) => Number.isFinite(h3.expectedMargin));
    return {
      jobs: list.length,
      days: (Math.max(...list.map((h3) => h3.endedAt)) - Math.min(...list.map((h3) => h3.endedAt))) / 864e5,
      profit,
      perHour: hours > 0 ? profit / hours : null,
      margin: revenue > 0 ? profit / revenue : null,
      expectedMargin: expected.length ? expected.reduce((s2, h3) => s2 + h3.expectedMargin, 0) / expected.length : null
    };
  }
  function jobReport(ledger, job, prices2, now2 = Date.now()) {
    const f = job.forecast;
    const actions = job.actions;
    const hours = job.hours;
    const made = [];
    const used = [];
    const lots = lotsLeft(ledger, job.key);
    for (const [key2, d] of Object.entries(job.deltas)) {
      if (Math.abs(d) < 1e-9) continue;
      const { itemHrid, level } = splitKey(key2);
      if (d > 0) {
        const unit = itemHrid === COIN5 ? 1 : prices2.value(itemHrid, level) ?? 0;
        made.push({ itemHrid, level, qty: d, unit, total: d * unit });
      } else {
        const qty2 = -d;
        const fromLots = itemHrid === COIN5 ? { qty: 0, cost: 0, estimate: false } : takeLots(lots, key2, qty2, job.endedAt);
        const rest = qty2 - fromLots.qty;
        const restUnit = itemHrid === COIN5 ? 1 : prices2.cost(itemHrid, level) ?? 0;
        const total = fromLots.cost + rest * restUnit;
        used.push({ itemHrid, level, qty: qty2, unit: total / qty2, total, bought: fromLots.qty, boughtEstimate: fromLots.estimate });
      }
    }
    made.sort((a, b) => b.total - a.total);
    used.sort((a, b) => b.total - a.total);
    const teas = f ? f.teaPerHour * hours : 0;
    const revenue = made.reduce((s2, m2) => s2 + m2.total, 0);
    const cost = used.reduce((s2, u) => s2 + u.total, 0) + teas;
    const profit = revenue - cost;
    const report = {
      id: job.id,
      key: job.key,
      name: job.name,
      actionHrid: job.actionHrid,
      item: job.item,
      endedAt: job.endedAt,
      pricedAt: now2,
      actions,
      hours,
      made,
      used,
      teas,
      revenue,
      cost,
      profit,
      margin: revenue > 0 ? profit / revenue : null,
      perHour: hours > 0 ? profit / hours : null,
      actionsPerHour: hours > 0 ? actions / hours : null,
      // now: worked out when the result was (the job began unseen); settled: from its first action (else as it was queued).
      forecast: f ? { ...compare(f, made, used, teas, hours, actions), now: !!job.forecastNow, settled: job.forecastSettled ?? null, catalyst: f.catalyst ?? null, teas: f.teas ?? null } : null
    };
    return report;
  }
  function compare(f, made, used, teas, hours, actions) {
    const primary = f.inputs.filter((i) => i.itemHrid !== COIN5 && !i.catalyst).sort((a, b) => b.count * b.price - a.count * a.price)[0];
    const usedOf = (hrid) => used.find((u) => u.itemHrid === hrid && u.level === 0);
    const n5 = primary && usedOf(primary.itemHrid) ? usedOf(primary.itemHrid).qty / primary.count : actions;
    const parts = { yield: 0, prices: 0, usage: 0, bought: 0, teas: 0 };
    const outs = new Map(f.outputs.map((o2) => [o2.itemHrid, o2]));
    for (const m2 of made) {
      const o2 = m2.level === 0 ? outs.get(m2.itemHrid) : null;
      const expected = o2 ? o2.count * n5 : 0;
      parts.yield += (m2.qty - expected) * m2.unit;
      if (o2) parts.prices += expected * (m2.unit - o2.price);
    }
    for (const o2 of f.outputs) {
      if (!made.some((m2) => m2.itemHrid === o2.itemHrid && m2.level === 0)) parts.yield -= o2.count * n5 * o2.price;
    }
    const ins = new Map(f.inputs.map((i) => [i.itemHrid, i]));
    for (const u of used) {
      const i = u.level === 0 ? ins.get(u.itemHrid) : null;
      const expected = i ? i.count * n5 : 0;
      const price = i ? i.price : u.unit;
      parts.usage -= (u.qty - expected) * price;
      parts.bought -= u.qty * (u.unit - price);
    }
    for (const i of f.inputs) {
      if (!used.some((u) => u.itemHrid === i.itemHrid && u.level === 0)) parts.usage += i.count * n5 * i.price;
    }
    const expectedTeas = f.actionsPerHour > 0 ? f.teaPerHour / f.actionsPerHour * n5 : 0;
    parts.teas = expectedTeas - teas;
    const profit = f.profitPerAction * n5;
    return { actions: n5, profit, margin: f.margin, perHour: f.profitPerHour, actionsPerHour: f.actionsPerHour, parts };
  }
  function compactForecast(row) {
    const entry = row?.single || row;
    if (!entry || !(entry.actionsPerHour > 0)) return null;
    return {
      name: entry.name,
      actionsPerHour: entry.actionsPerHour,
      teaPerHour: entry.teaPerHour || 0,
      profitPerHour: entry.profitPerHour,
      profitPerAction: entry.profitPerHour / entry.actionsPerHour,
      margin: entry.margin ?? null,
      inputs: (entry.inputs || []).filter((i) => i.count > 0).map((i) => ({ itemHrid: i.itemHrid, count: i.count, price: i.price || 0, ...i.catalyst ? { catalyst: true } : {} })),
      outputs: (entry.outputs || []).filter((o2) => o2.count > 0).map((o2) => ({ itemHrid: o2.itemHrid, count: o2.count, price: o2.price || 0 }))
    };
  }

  // src/job-log.js
  var KEY = "mwia-jobs";
  var COIN6 = "/items/coin";
  var HEADING = /^loot\s*&\s*xp\s*log$/i;
  var START = /^Start Time:\s*(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)/;
  var MAX_FORECASTS = 60;
  var j = { deps: null, ledger: null, preparing: null, timer: null, soFar: /* @__PURE__ */ new Map(), sync: null, changed: /* @__PURE__ */ new Set() };
  var PI_WAIT_MS = 4e3;
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && saved.purchases) return { ...emptyLedger(), ...saved, unsent: { reports: [], purchases: [], ...saved.unsent } };
      if (saved && Array.isArray(saved.lots)) {
        const L2 = { ...emptyLedger(), fills: saved.fills || {}, forecasts: saved.forecasts || {}, since: saved.since || Date.now() };
        for (const lot of saved.lots) L2.purchases[`v051-${lot.id ?? lot.at}`] = { key: lot.key, filled: lot.qty, cost: lot.qty * lot.unit, at: lot.at, estimate: !!lot.estimate };
        for (const [key2, report] of Object.entries(saved.reports || {})) if (report?.used && Number.isFinite(report.endedAt)) keepReport(L2, key2, { ...report, key: key2 });
        L2.unsent.purchases = Object.keys(L2.purchases);
        return L2;
      }
    } catch {
    }
    return emptyLedger();
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(j.ledger));
    } catch {
    }
  }
  function startJobLog(deps) {
    j.deps = deps;
    j.ledger = load();
    onStateChange(onMessage2);
    if (state.character) onMessage2("init_character_data", state.character);
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(".mwia-jobline"))) return;
      schedule();
    }).observe(document.body, { childList: true, subtree: true });
  }
  function onMessage2(type, data) {
    try {
      const L2 = j.ledger;
      if (type === "init_character_data" || type === "market_listings_updated") {
        const listings = data.myMarketListings ?? data.marketListings ?? data.endMarketListings ?? [];
        if (noteFills(L2, listings, { now: Date.now(), live: type === "market_listings_updated", bookOf: (hrid, level) => orderBookAt(hrid, level)?.asks || null })) changed();
        save();
      }
      if (type === "init_character_data" || type === "actions_updated" || type === "action_completed") keepForecast(type === "action_completed");
      if (type === "actions_updated") schedule();
      if (type === "loot_log_updated") {
        const synced = j.sync ? Promise.race([j.sync().catch(() => null), new Promise((r) => setTimeout(r, PI_WAIT_MS))]) : Promise.resolve();
        synced.then(() => {
          reportLog();
          schedule();
        });
      }
    } catch (error) {
      console.error("[MWI Advisor] job log", error);
    }
  }
  var ready = () => !!getClientData() && pricesStamp() > 0;
  function whenReady(then) {
    if (ready()) return true;
    j.preparing || (j.preparing = j.deps?.prepare().then(() => then()).catch((error) => console.warn("[MWI Advisor] job log", error)).finally(() => j.preparing = null));
    return false;
  }
  var settings = () => ({ ...j.deps?.settings() || {}, skillingTeas: "current" });
  var itemOfHash2 = (hash2) => String(hash2 || "").split("::")[2] || null;
  var levelOfHash2 = (hash2) => Number(String(hash2 || "").split("::")[3]) || 0;
  var skillOf2 = (actionHrid) => String(actionHrid || "").split("/")[2] || "";
  var counted = (actionHrid) => !!actionHrid && !["combat", "enhancing"].includes(skillOf2(actionHrid));
  function keepForecast(completed = false) {
    const L2 = j.ledger;
    const running2 = runningAction(state.character?.characterActions);
    if (!running2 || !counted(running2.actionHrid)) return;
    const kept2 = L2.forecasts[running2.id];
    if (kept2 && (kept2.settled || !completed)) return;
    if (!whenReady(() => keepForecast(completed))) return;
    L2.forecasts[running2.id] = { at: kept2?.at ?? Date.now(), settled: completed, forecast: forecastFor(running2.actionHrid, itemOfHash2(running2.primaryItemHash), levelOfHash2(running2.primaryItemHash)) };
    const ids = Object.keys(L2.forecasts).sort((a, b) => L2.forecasts[a].at - L2.forecasts[b].at);
    for (const id of ids.slice(0, Math.max(0, ids.length - MAX_FORECASTS))) delete L2.forecasts[id];
    save();
  }
  function forecastFor(actionHrid, item, level = 0) {
    try {
      const entry = skillingAdvice(actionHrid, settings(), item ? { itemHrid: item, level } : null);
      if (!entry?.valid) return null;
      const f = compactForecast(entry);
      if (f) {
        f.name = adviceName(entry);
        f.catalyst = entry.catalyst?.itemHrid || null;
        f.teas = entry.teas || [];
      }
      return f;
    } catch (error) {
      console.warn("[MWI Advisor] job log forecast", error);
      return null;
    }
  }
  var entryKey = (e2) => `${e2.characterActionId}|${e2.startTime}`;
  var time = (text) => {
    const t4 = Date.parse(text);
    return Number.isFinite(t4) && t4 > Date.UTC(2e3, 0, 1) ? t4 : null;
  };
  var ended = (e2) => time(e2.endTime) !== null && time(e2.endTime) > time(e2.startTime);
  function running(e2) {
    const queue = state.character?.characterActions;
    if (!queue) return !ended(e2);
    return queue.some((a) => a.id === e2.characterActionId && a.actionHrid === e2.actionHrid && !a.isDone);
  }
  var stale = (kept2, e2) => kept2.actions !== (Number(e2.actionCount) || 0) || kept2.endedAt !== time(e2.endTime);
  var changed = () => {
    for (const listener of j.changed) listener();
  };
  function useJobSync(sync) {
    j.sync = sync;
  }
  function onJobsChanged(listener) {
    j.changed.add(listener);
  }
  var jobsPiSeq = () => j.ledger?.piSeq || 0;
  var jobsForPi = () => j.ledger ? unsentForPi(j.ledger) : { reports: [], purchases: [] };
  function jobsSentToPi(sent) {
    if (!j.ledger) return;
    markSent(j.ledger, sent);
    save();
  }
  function jobsFromPi(wire) {
    if (!j.ledger) return;
    if (mergeFromPi2(j.ledger, wire)) schedule();
    save();
  }
  function reportLog() {
    const L2 = j.ledger;
    const log2 = (state.lootLog || []).filter((e2) => counted(e2.actionHrid) && time(e2.startTime) !== null);
    const todo = log2.filter((e2) => running(e2) ? ended(e2) : ended(e2) && (!L2.history[entryKey(e2)] || stale(L2.history[entryKey(e2)], e2)));
    if (!todo.length || !whenReady(() => (reportLog(), schedule()))) return;
    const data = getClientData();
    for (const e2 of todo.sort((a, b) => time(a.endTime) - time(b.endTime))) {
      const keptEntry = L2.forecasts[e2.characterActionId];
      const kept2 = keptEntry?.forecast || null;
      const item = itemOfHash2(e2.primaryItemHash);
      const forecast = kept2 || forecastFor(e2.actionHrid, item);
      const job = {
        id: e2.characterActionId,
        actionHrid: e2.actionHrid,
        item,
        endedAt: time(e2.endTime),
        actions: Number(e2.actionCount) || 0,
        hours: (time(e2.endTime) - time(e2.startTime)) / 36e5,
        deltas: entryDeltas(e2, data, forecast),
        forecast,
        forecastNow: !kept2 && !!forecast,
        forecastSettled: kept2 ? keptEntry.settled !== false : null
      };
      job.name = forecast?.name || jobName(e2, data);
      const key2 = entryKey(e2);
      job.key = key2;
      const report = jobReport(L2, job, pricesFor(forecast));
      report.catalyst = itemOfHash2(e2.secondaryItemHash);
      if (running(e2)) {
        j.soFar.set(key2, report);
        continue;
      }
      j.soFar.delete(key2);
      keepReport(L2, key2, report);
      changed();
    }
    save();
  }
  function entryDeltas(e2, data, forecast) {
    const deltas = {};
    const add = (key2, d) => deltas[key2] = (deltas[key2] || 0) + d;
    for (const [key2, n5] of Object.entries(e2.drops || {})) add(key2.includes("::") ? key2 : keyOf(key2), Number(n5) || 0);
    const count3 = Number(e2.actionCount) || 0;
    const item = itemOfHash2(e2.primaryItemHash);
    if (skillOf2(e2.actionHrid) === "alchemy") {
      const kind = e2.actionHrid.split("/").pop();
      const detail = data.itemDetailMap[item];
      if (!detail || !ALCHEMY_KINDS[kind]) return deltas;
      const bulk = bulkOf(detail);
      const level = levelOfHash2(e2.primaryItemHash);
      add(keyOf(item, level), -bulk * count3);
      const coins10 = coinCost(kind, detail) * count3;
      if (coins10) add(keyOf(COIN6), -coins10);
      const catalyst = itemOfHash2(e2.secondaryItemHash);
      if (catalyst) {
        const per = successOutputs(kind, detail, level).filter((o2) => o2.count > 0);
        const dropped = (o2) => Number(e2.drops?.[keyOf(o2.itemHrid)]) || 0;
        const successes = Math.min(
          count3,
          Math.round(
            kind === "transmute" ? per.reduce((sum, o2) => sum + dropped(o2), 0) / Math.max(1e-9, per.reduce((sum, o2) => sum + o2.count * bulk, 0)) : Math.max(0, ...per.map((o2) => dropped(o2) / (o2.count * bulk)))
          )
        );
        add(keyOf(catalyst), -successes);
      }
      return deltas;
    }
    const action = data.actionDetailMap[e2.actionHrid];
    const inputs = forecast?.inputs?.length ? forecast.inputs : [...action?.inputItems || [], ...action?.upgradeItemHrid ? [{ itemHrid: action.upgradeItemHrid, count: 1 }] : []];
    for (const input of inputs) add(keyOf(input.itemHrid), -input.count * count3);
    return deltas;
  }
  function jobName(e2, data) {
    const item = itemOfHash2(e2.primaryItemHash);
    if (skillOf2(e2.actionHrid) === "alchemy") return `${ALCHEMY_KINDS[e2.actionHrid.split("/").pop()]?.name || "Alchemy"} ${item ? itemName(item) : ""}`.trim();
    return data.actionDetailMap[e2.actionHrid]?.name || e2.actionHrid.split("/").pop();
  }
  function pricesFor(forecast) {
    const sellAt = settings().skillingSellAt === "bid" ? "bid" : "ask";
    const market = skillingMarket(sellAt);
    const advised = new Map((forecast?.inputs || []).map((i) => [i.itemHrid, i.price]));
    return {
      value(hrid, level) {
        if (!level) return market.sell(hrid).price;
        const e2 = marketEntry(hrid, level);
        const p2 = sellAt === "ask" ? e2?.a || e2?.b : e2?.b || e2?.a;
        return p2 > 0 ? p2 * (1 - MARKET_TAX) : getClientData()?.itemDetailMap?.[hrid]?.sellPrice || 0;
      },
      cost(hrid, level) {
        if (!level && advised.get(hrid) > 0) return advised.get(hrid);
        if (!level) return market.buy(hrid) ?? market.sell(hrid).bid ?? 0;
        const e2 = marketEntry(hrid, level);
        return e2?.a || e2?.b || 0;
      }
    };
  }
  function schedule() {
    if (j.timer) return;
    j.timer = setTimeout(() => {
      j.timer = null;
      decorate();
    }, 300);
  }
  var pad = (n5) => String(n5).padStart(2, "0");
  function localStamp(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function decorate() {
    const heading = [...document.querySelectorAll("div,h1,h2,h3,span")].find((el) => el.children.length === 0 && HEADING.test(el.textContent.trim()) && visible(el));
    if (!heading || !state.lootLog) return;
    const byStart = new Map(state.lootLog.filter((e2) => counted(e2.actionHrid) && time(e2.startTime) !== null).map((e2) => [localStamp(time(e2.startTime)), e2]));
    for (const el of document.querySelectorAll("div,span,p")) {
      if (el.children.length !== 0) continue;
      const match = START.exec(el.textContent.trim());
      const e2 = match && byStart.get(match[1]);
      if (!e2) continue;
      let card = el.parentElement;
      for (let i = 0; i < 3 && card && !/Duration/.test(card.textContent); i++) card = card.parentElement;
      if (!card) continue;
      const key2 = entryKey(e2);
      const report = j.ledger.reports[key2];
      const kept2 = j.ledger.history[key2];
      const soFar = j.soFar.get(key2);
      const html = running(e2) ? soFar && soFar.actions === (Number(e2.actionCount) || 0) ? lineHtml(soFar, "running") : `<div class="mwia-dim">\u{1F9ED} running \u2013 the result comes when it ends</div>` : report && kept2 && !stale(kept2, e2) ? lineHtml(report) : soFar ? lineHtml(soFar, "ended") : `<div class="mwia-dim">\u{1F9ED} working it out\u2026</div>`;
      let line = [...card.children].find((c2) => c2.classList.contains("mwia-jobline"));
      if (!line) {
        line = document.createElement("div");
        line.className = "mwia-jobline";
        card.appendChild(line);
      }
      if (line.dataset.html !== html) {
        const open2 = line.querySelector("details")?.open;
        line.dataset.html = html;
        line.innerHTML = html;
        if (open2) line.querySelector("details").open = true;
      }
    }
  }
  var coins2 = (n5) => (n5 < 0 ? "\u2212" : "") + shortCoins(Math.abs(n5));
  var signed = (n5) => (n5 >= 0 ? "+" : "\u2212") + shortCoins(Math.abs(n5));
  var pct2 = (x) => x === null || x === void 0 ? "\u2013" : `${(x * 100).toFixed(1)}%`;
  var qty = (n5) => Math.abs(n5 - Math.round(n5)) < 1e-6 ? Math.round(n5).toLocaleString("en-US") : n5.toLocaleString("en-US", { maximumFractionDigits: 1 });
  var levelText = (level) => level ? ` +${level}` : "";
  function duration(hours) {
    const minutes = Math.round(hours * 60);
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  }
  function lineHtml(r, state2 = null) {
    const f = r.forecast;
    const head4 = `\u{1F9ED} ${state2 ? `<span class="mwia-dim">${state2 === "running" ? "so far" : "ended \u2013 tap Refresh"}:</span> ` : ""}<b class="${r.profit >= 0 ? "mwia-ok" : "mwia-bad"}">${signed(r.profit)}</b>${r.perHour !== null ? ` \xB7 ${coins2(r.perHour)}/h` : ""} \xB7 margin ${pct2(r.margin)}${f ? ` <span class="mwia-dim">(${pct2(f.margin)} expected)</span>` : ""}`;
    const lines = [];
    if (f) {
      lines.push(`Expected for these ${qty(f.actions)} actions${f.now ? " (advice worked out now \u2013 the job began before the advisor saw it)" : ""}: <b>${signed(f.profit)}</b> at a ${pct2(f.margin)} margin, ${coins2(f.perHour)}/h.`);
      const names2 = { yield: "what came out", prices: "what it sells for now", usage: "what it used", bought: "what the materials cost", teas: "teas" };
      const parts = Object.entries(f.parts).filter(([, v]) => Math.abs(v) >= Math.max(1, Math.abs(r.revenue) * 2e-3)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      if (parts.length) lines.push(`Where the difference came from: ${parts.map(([k, v]) => `${names2[k]} <span class="${v >= 0 ? "mwia-ok" : "mwia-bad"}">${signed(v)}</span>`).join(" \xB7 ")}.`);
      if (r.actionsPerHour) lines.push(`Speed: ${qty(Math.round(r.actionsPerHour))} actions/h (${qty(Math.round(f.actionsPerHour))} expected) \xB7 ${duration(r.hours)}.`);
      if (f.teas) lines.push(`<span class="mwia-dim">The advice counted on ${f.teas.length ? f.teas.map((t4) => esc(itemName(t4))).join(", ") : "no teas"}${f.settled === false ? " (as the job was queued)" : ""}.</span>`);
      if (skillOf2(r.actionHrid) === "alchemy" && (f.catalyst || null) !== (r.catalyst || null)) lines.push(`<span class="mwia-dim">The advice counted on ${f.catalyst ? esc(itemName(f.catalyst)) : "no catalyst"}; the job used ${r.catalyst ? esc(itemName(r.catalyst)) : "none"}.</span>`);
    } else lines.push("No advice to compare with.");
    if (r.made.length) lines.push(`Made: ${r.made.map((m2) => `${qty(m2.qty)} ${esc(itemName(m2.itemHrid))}${levelText(m2.level)} \xD7 ${coins2(m2.unit)} = ${coins2(m2.total)}`).join(" \xB7 ")}.`);
    if (r.used.length) lines.push(`Used: ${r.used.map((u) => `${qty(u.qty)} ${esc(itemName(u.itemHrid))}${levelText(u.level)} \xD7 ${coins2(u.unit)} = ${coins2(u.total)}${u.bought > 0 ? ` <span class="mwia-dim">(${u.bought >= u.qty - 1e-6 ? "all" : qty(u.bought)} at what you paid${u.boughtEstimate ? ", bought at once: priced up the order book seen" : ""})</span>` : ""}`).join(" \xB7 ")}${r.teas >= 1 ? ` \xB7 teas \u2248 ${coins2(r.teas)}` : ""}.`);
    const earlier = groupHistory(j.ledger, jobGroup(r.actionHrid, r.item), r.key);
    if (earlier) lines.push(`Earlier jobs like this: ${earlier.jobs}${earlier.days >= 1 ? ` over ${Math.round(earlier.days)} day${Math.round(earlier.days) === 1 ? "" : "s"}` : ""} \u2013 margin ${pct2(earlier.margin)}${earlier.expectedMargin !== null ? ` (${pct2(earlier.expectedMargin)} expected)` : ""}${earlier.perHour !== null ? `, ${coins2(earlier.perHour)}/h` : ""}, <span class="${earlier.profit >= 0 ? "mwia-ok" : "mwia-bad"}">${signed(earlier.profit)}</span> in all.`);
    if (state2 === "running") lines.push(`<span class="mwia-dim">Still running: what the log said when it was last fetched (tap Refresh for now); your purchases aren't used up until it ends.</span>`);
    if (state2 === "ended") lines.push(`<span class="mwia-dim">It has ended since the log was fetched: tap Refresh for the whole job.</span>`);
    const age = Math.max(0, Math.round((r.pricedAt - r.endedAt) / 6e4));
    lines.push(`<span class="mwia-dim">Made at the market ${age > 5 ? `${duration(age / 60)} after it ended (when first seen)` : "as it ended"}, the ${Math.round(MARKET_TAX * 100)}% tax off; used at what you paid, else the advice's price${r.teas >= 1 ? "; teas at the advice's rate" : ""}${skillOf2(r.actionHrid) === "alchemy" ? "; the catalyst one per success, from what the successes dropped" : "; materials as the action takes them (Artisan's saving as expected)"}.</span>`);
    return `<details><summary>${head4}</summary>${lines.map((l2) => `<p>${l2}</p>`).join("")}</details>`;
  }

  // src/stats.js
  function logGamma(x) {
    const c2 = [76.18009172947146, -86.50532032941678, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -5395239384953e-18];
    let y = x;
    const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
    let series = 1.000000000190015;
    for (const coefficient of c2) series += coefficient / ++y;
    return -tmp + Math.log(2.5066282746310007 * series / x);
  }
  function betaContinuedFraction(a, b, x) {
    const tiny = 1e-30;
    let c2 = 1;
    let d = 1 - (a + b) * x / (a + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h3 = d;
    for (let m2 = 1; m2 <= 200; m2++) {
      const m22 = 2 * m2;
      let aa = m2 * (b - m2) * x / ((a + m22 - 1) * (a + m22));
      d = 1 + aa * d;
      if (Math.abs(d) < tiny) d = tiny;
      c2 = 1 + aa / c2;
      if (Math.abs(c2) < tiny) c2 = tiny;
      d = 1 / d;
      h3 *= d * c2;
      aa = -(a + m2) * (a + b + m2) * x / ((a + m22) * (a + m22 + 1));
      d = 1 + aa * d;
      if (Math.abs(d) < tiny) d = tiny;
      c2 = 1 + aa / c2;
      if (Math.abs(c2) < tiny) c2 = tiny;
      d = 1 / d;
      const delta = d * c2;
      h3 *= delta;
      if (Math.abs(delta - 1) < 3e-12) break;
    }
    return h3;
  }
  function incompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? front * betaContinuedFraction(a, b, x) / a : 1 - front * betaContinuedFraction(b, a, 1 - x) / b;
  }
  function studentTCdf(t4, df) {
    const tail = 0.5 * incompleteBeta(df / (df + t4 * t4), df / 2, 0.5);
    return t4 > 0 ? 1 - tail : tail;
  }
  function confidenceGreater(a, b) {
    const stats = (x) => {
      const mean = x.reduce((s2, v) => s2 + v, 0) / x.length;
      return { n: x.length, mean, variance: x.reduce((s2, v) => s2 + (v - mean) ** 2, 0) / (x.length - 1) };
    };
    if (a.length < 2 || b.length < 2) return null;
    const A = stats(a);
    const B = stats(b);
    const va = A.variance / A.n;
    const vb = B.variance / B.n;
    const diff = A.mean - B.mean;
    if (va + vb <= 1e-18) return diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
    const df = (va + vb) ** 2 / (va * va / (A.n - 1) + vb * vb / (B.n - 1));
    return studentTCdf(diff / Math.sqrt(va + vb), df);
  }
  function confidenceOneRun(value, reference, margin = 0) {
    const n5 = reference.length;
    if (n5 < 2) return null;
    const mean = reference.reduce((s2, v) => s2 + v, 0) / n5;
    const sd = Math.sqrt(reference.reduce((s2, v) => s2 + (v - mean) ** 2, 0) / (n5 - 1));
    const diff = value - margin - mean;
    if (sd <= 1e-9) return diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
    return studentTCdf(diff / (sd * Math.sqrt(1 + 1 / n5)), n5 - 1);
  }

  // src/profile.js
  var COMBAT_SKILLS = ["stamina", "intelligence", "attack", "melee", "defense", "ranged", "magic"];
  var GEAR_TYPES = [
    "main_hand",
    "two_hand",
    "off_hand",
    "head",
    "body",
    "legs",
    "feet",
    "hands",
    "neck",
    "earrings",
    "ring",
    "back",
    "pouch",
    "charm"
  ];
  var INVENTORY3 = "/item_locations/inventory";
  var COMBAT = "/action_types/combat";
  function emptyTriggers(list) {
    return (list || []).map((t4) => ({
      dependencyHrid: t4.dependencyHrid,
      conditionHrid: t4.conditionHrid,
      comparatorHrid: t4.comparatorHrid,
      value: t4.value ?? 0
    }));
  }
  var STYLES = {
    magic: ["/combat_styles/magic"],
    ranged: ["/combat_styles/ranged"],
    melee: ["/combat_styles/stab", "/combat_styles/slash", "/combat_styles/smash"]
  };
  var STYLE_NAMES = { magic: "Magic", ranged: "Ranged", melee: "Melee" };
  function styleOfItem(item) {
    const first = item?.equipmentDetail?.combatStats?.combatStyleHrids?.[0];
    return Object.keys(STYLES).find((style) => STYLES[style].includes(first)) || null;
  }
  function weaponOf(profile) {
    return profile.equipment.main_hand || profile.equipment.two_hand || null;
  }
  function weaponStyle(profile, data) {
    const weapon = weaponOf(profile);
    return weapon && styleOfItem(data.itemDetailMap[weapon.hrid]) || "melee";
  }
  function styleSkills(style, data) {
    const map = data.combatStyleDetailMap?.[STYLES[style][0]]?.skillExpMap;
    return map ? Object.keys(map).map((hrid) => hrid.split("/").pop()) : ["stamina", "intelligence", "attack", "defense", style];
  }
  function combatLevel(levels) {
    const { stamina, intelligence, attack, melee, defense, ranged, magic } = levels;
    return 0.1 * (stamina + intelligence + attack + defense + Math.max(melee, ranged, magic)) + 0.5 * Math.max(attack, defense, melee, ranged, magic);
  }
  function buildProfile(character, items, data) {
    const allLevels = {};
    const allExperience = {};
    for (const skill of character.characterSkills || []) {
      allLevels[skill.skillHrid] = skill.level;
      allExperience[skill.skillHrid] = skill.experience ?? null;
    }
    const levels = {};
    for (const skill of COMBAT_SKILLS) levels[skill] = allLevels["/skills/" + skill] ?? 1;
    const totalLevel = allLevels["/skills/total_level"] ?? Object.entries(allLevels).filter(([hrid]) => hrid !== "/skills/total_level").reduce((sum, [, level]) => sum + level, 0);
    const equipment = {};
    const inventory = [];
    for (const item of items.values()) {
      if (!item.itemHrid) continue;
      if (item.itemLocationHrid === INVENTORY3) {
        inventory.push({ hrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0, count: item.count ?? 1 });
        continue;
      }
      const type = item.itemLocationHrid?.split("/").pop();
      if (GEAR_TYPES.includes(type)) equipment[type] = { hrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 };
    }
    const food = (character.actionTypeFoodSlotsMap?.[COMBAT] || []).map((slot) => slot?.itemHrid || null);
    const drinks = (character.actionTypeDrinkSlotsMap?.[COMBAT] || []).map((slot) => slot?.itemHrid || null);
    const learnedAbilities = {};
    const abilityExperience = {};
    for (const ability of character.characterAbilities || []) {
      learnedAbilities[ability.abilityHrid] = ability.level || 1;
      abilityExperience[ability.abilityHrid] = ability.experience || 0;
    }
    const abilities = [null, null, null, null, null];
    const slotOf = {};
    for (const ability of character.characterAbilities || []) slotOf[ability.abilityHrid] = ability.slotNumber ?? 0;
    const combatAbilities = character.combatUnit?.combatAbilities;
    const equipped = (Array.isArray(combatAbilities) && combatAbilities.length ? [...combatAbilities] : (character.characterAbilities || []).filter((a) => a.slotNumber > 0)).sort((a, b) => (slotOf[a.abilityHrid] ?? 0) - (slotOf[b.abilityHrid] ?? 0));
    let next = 1;
    for (const ability of equipped) {
      if (!ability?.abilityHrid) continue;
      const entry = { hrid: ability.abilityHrid, level: ability.level || learnedAbilities[ability.abilityHrid] || 1 };
      if (data.abilityDetailMap[ability.abilityHrid]?.isSpecialAbility) abilities[0] = entry;
      else if (next <= 4) abilities[next++] = entry;
    }
    const houseRooms = {};
    for (const room of Object.values(character.characterHouseRoomMap || {})) houseRooms[room.houseRoomHrid] = room.level;
    const achievements = {};
    for (const achievement of character.characterAchievements || []) {
      if (achievement.isCompleted) achievements[achievement.achievementHrid] = true;
    }
    const extraBuffs = [];
    for (const map of ["communityActionTypeBuffsMap", "mooPassActionTypeBuffsMap", "personalActionTypeBuffsMap", "guildActionTypeBuffsMap"]) {
      for (const buff of character[map]?.[COMBAT] || []) {
        if (!buff?.typeHrid) continue;
        extraBuffs.push({
          uniqueHrid: buff.uniqueHrid || map + buff.typeHrid,
          typeHrid: buff.typeHrid,
          ratioBoost: buff.ratioBoost || 0,
          ratioBoostLevelBonus: 0,
          flatBoost: buff.flatBoost || 0,
          flatBoostLevelBonus: 0,
          duration: 0
        });
      }
    }
    const combatAction = (character.characterActions || []).find((a) => a.actionHrid?.startsWith("/actions/combat/"));
    return {
      name: character.character?.name || "",
      levels,
      allLevels,
      allExperience,
      totalLevel,
      equipment,
      inventory,
      food,
      drinks,
      abilities,
      learnedAbilities,
      abilityExperience,
      abilityTriggers: character.abilityCombatTriggersMap || {},
      consumableTriggers: character.consumableCombatTriggersMap || {},
      houseRooms,
      achievements,
      extraBuffs,
      currentZone: combatAction ? { zoneHrid: combatAction.actionHrid, tier: combatAction.difficultyTier || 0 } : null
    };
  }
  function combatLoadouts(character) {
    return Object.entries(character?.characterLoadoutMap || {}).filter(([, loadout]) => loadout && (!loadout.actionTypeHrid || loadout.actionTypeHrid === COMBAT)).map(([id, loadout]) => ({ ...loadout, id: String(id) })).sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
  }
  function chooseLoadout(character, choice) {
    if (choice === "equipped") return null;
    const loadouts = combatLoadouts(character);
    const picked = choice && choice !== "auto" ? loadouts.find((l2) => l2.id === String(choice)) : null;
    return picked || loadouts.find((l2) => l2.isDefault && l2.actionTypeHrid === COMBAT) || loadouts.find((l2) => l2.isDefault) || loadouts[0] || null;
  }
  var levelOfHash3 = (hash2) => {
    const last = String(hash2 || "").split("::").pop();
    return /^\d+$/.test(last) ? Number(last) : null;
  };
  function loadoutItem(location2, hash2, items, exact, taken) {
    const itemHrid = String(hash2 || "").split("::").find((part2) => part2.startsWith("/items/"));
    if (!itemHrid) return null;
    const saved = levelOfHash3(hash2);
    const usable = [...items].filter(
      (item) => item.itemHrid === itemHrid && item.count !== 0 && (taken.get(item) ?? 0) < (item.count ?? 1) && (item.hash === hash2 || item.itemLocationHrid === location2 || item.itemLocationHrid === INVENTORY3) && (!exact || (item.enhancementLevel || 0) === saved)
    );
    usable.sort((a, b) => (b.enhancementLevel || 0) - (a.enhancementLevel || 0) || (b.hash === hash2) - (a.hash === hash2));
    return usable[0] ? { item: usable[0], itemHrid } : { item: null, itemHrid };
  }
  function applyLoadout(profile, loadout, items, data) {
    if (!loadout) return profile;
    const owned = [...items.values()].filter((item) => item.itemHrid);
    const taken = /* @__PURE__ */ new Map();
    const missing = [];
    const equipment = {};
    for (const [location2, hash2] of Object.entries(loadout.wearableMap || {})) {
      const type = location2.split("/").pop();
      if (!GEAR_TYPES.includes(type) || !hash2) continue;
      const found = loadoutItem(location2, hash2, owned, loadout.useExactEnhancement === true, taken);
      if (!found) continue;
      if (!found.item) {
        missing.push({ hrid: found.itemHrid, enhancementLevel: levelOfHash3(hash2) || 0 });
        continue;
      }
      taken.set(found.item, (taken.get(found.item) ?? 0) + 1);
      equipment[type] = { hrid: found.itemHrid, enhancementLevel: found.item.enhancementLevel || 0 };
    }
    const inventory = /* @__PURE__ */ new Map();
    const stash = (hrid, enhancementLevel, count3) => {
      const key2 = hrid + "#" + enhancementLevel;
      const entry = inventory.get(key2) || { hrid, enhancementLevel, count: 0 };
      entry.count += count3;
      inventory.set(key2, entry);
    };
    for (const item of owned) {
      const worn2 = item.itemLocationHrid !== INVENTORY3;
      if (worn2 && !GEAR_TYPES.includes(item.itemLocationHrid?.split("/").pop())) continue;
      const left = (item.count ?? 1) - (taken.get(item) ?? 0);
      if (left > 0) stash(item.itemHrid, item.enhancementLevel || 0, left);
    }
    const consumables = (list) => Array.isArray(list) ? list.map((hrid) => hrid || null) : null;
    const abilities = [null, null, null, null, null];
    let next = 1;
    const slots = Object.entries(loadout.abilityMap || {}).filter(([, hrid]) => hrid).sort((a, b) => Number(a[0]) - Number(b[0]));
    for (const [, hrid] of slots) {
      if (!profile.learnedAbilities[hrid]) continue;
      const entry = { hrid, level: profile.learnedAbilities[hrid] };
      if (data.abilityDetailMap[hrid]?.isSpecialAbility) abilities[0] = entry;
      else if (next <= 4) abilities[next++] = entry;
    }
    return {
      ...profile,
      equipment,
      inventory: [...inventory.values()],
      food: consumables(loadout.foodItemHrids) ?? profile.food,
      drinks: consumables(loadout.drinkItemHrids) ?? profile.drinks,
      abilities: loadout.abilityMap ? abilities : profile.abilities,
      abilityTriggers: { ...profile.abilityTriggers, ...loadout.abilityCombatTriggersMap || {} },
      consumableTriggers: { ...profile.consumableTriggers, ...loadout.consumableCombatTriggersMap || {} },
      loadout: { id: loadout.id, name: loadout.name || "Loadout", missing }
    };
  }
  function consumableKinds(hrid, data) {
    const detail = data.itemDetailMap[hrid]?.consumableDetail;
    if (!detail) return [hrid];
    const timed = (detail.recoveryDuration || 0) > 0 ? "time" : "instant";
    if ((detail.hitpointRestore || 0) > 0) return ["hp:" + timed];
    if ((detail.manapointRestore || 0) > 0) return ["mp:" + timed];
    const buffs = (detail.buffs || []).map((b) => b.uniqueHrid || b.typeHrid).filter(Boolean);
    return buffs.length ? buffs : [hrid];
  }
  function sameKind(a, b, data) {
    if (!a || !b) return false;
    if (a === b) return true;
    const kinds = new Set(consumableKinds(a, data));
    return consumableKinds(b, data).some((kind) => kinds.has(kind));
  }
  function cloneProfile(profile) {
    return structuredClone(profile);
  }
  function meetsRequirements(profile, requirements) {
    return (requirements || []).every((req) => {
      const level = req.skillHrid === "/skills/total_level" ? profile.totalLevel : profile.allLevels[req.skillHrid] ?? 0;
      return level >= req.level;
    });
  }
  function gearStat(data, gear, stat) {
    if (!gear) return 0;
    const detail = data.itemDetailMap[gear.hrid]?.equipmentDetail;
    return detail?.combatStats?.[stat] || 0;
  }
  function slotCounts(profile, data) {
    const requirements = data.abilitySlotsLevelRequirementList || [0, 1, 1, 20, 50, 90];
    let abilitySlots = 0;
    for (let i = 1; i <= 4; i++) {
      if (profile.levels.intelligence >= (requirements[i + 1] ?? Infinity)) abilitySlots++;
    }
    return {
      food: 1 + gearStat(data, profile.equipment.pouch, "foodSlots"),
      drinks: 1 + gearStat(data, profile.equipment.pouch, "drinkSlots"),
      abilities: abilitySlots,
      // normal slots 1..n
      special: profile.levels.intelligence >= (requirements[1] ?? Infinity)
    };
  }
  function battleAbilityOrder(profile, data) {
    const slots = slotCounts(profile, data);
    const entries = profile.abilities.slice(1, slots.abilities + 1).filter(Boolean);
    const noCooldown = (e2) => !(data.abilityDetailMap[e2.hrid]?.cooldownDuration > 0);
    return [...entries.filter((e2) => !noCooldown(e2)), ...entries.filter(noCooldown)];
  }
  function toDTO(profile, data) {
    const slots = slotCounts(profile, data);
    const equipment = {};
    for (const [type, gear] of Object.entries(profile.equipment)) {
      if (gear) equipment["/equipment_types/" + type] = { hrid: gear.hrid, enhancementLevel: gear.enhancementLevel };
    }
    const consumable = (hrid) => hrid ? {
      hrid,
      triggers: emptyTriggers(profile.consumableTriggers[hrid] || data.itemDetailMap[hrid]?.consumableDetail?.defaultCombatTriggers)
    } : null;
    const ability = (entry, index) => {
      if (!entry) return null;
      if (index === 0 ? !slots.special : index > slots.abilities) return null;
      return {
        hrid: entry.hrid,
        level: entry.level,
        triggers: emptyTriggers(profile.abilityTriggers[entry.hrid] || data.abilityDetailMap[entry.hrid]?.defaultCombatTriggers)
      };
    };
    return {
      hrid: "player1",
      staminaLevel: profile.levels.stamina,
      intelligenceLevel: profile.levels.intelligence,
      attackLevel: profile.levels.attack,
      meleeLevel: profile.levels.melee,
      defenseLevel: profile.levels.defense,
      rangedLevel: profile.levels.ranged,
      magicLevel: profile.levels.magic,
      equipment,
      food: profile.food.slice(0, slots.food).map(consumable),
      drinks: profile.drinks.slice(0, slots.drinks).map(consumable),
      abilities: [ability(profile.abilities[0], 0), ...battleAbilityOrder(profile, data).map((e2, i) => ability(e2, i + 1))],
      houseRooms: profile.houseRooms,
      achievements: profile.achievements,
      debuffOnLevelGap: 0
    };
  }
  function equip(profile, type, gear) {
    const equipment = profile.equipment;
    if (type === "two_hand") {
      delete equipment.main_hand;
      delete equipment.off_hand;
    } else if (type === "main_hand") {
      delete equipment.two_hand;
    }
    equipment[type] = gear;
  }

  // src/version-tag.js
  var VERSION = true ? "0.77.0" : "dev";
  var UPDATE_URL = true ? "https://raw.githubusercontent.com/tarzanz/mwi-combat-advisor/main/dist/mwi-combat-advisor.user.js" : "";
  var LATEST_URL = UPDATE_URL.replace(/dist\/[^/]+$/, "package.json");
  var CHECK_EVERY_MS = 6 * 60 * 60 * 1e3;
  var SCAN_MS = 400;
  var NAME = '[class*="Header_characterInfo"] [class*="Header_name__"]';
  var NAME_ROW = '[class*="CharacterName_characterName__"]';
  var versionTag = { latest: null, checked: 0, scanTimer: null };
  var scriptVersion = () => VERSION;
  function isNewer(a, b) {
    const pa = String(a).split(".").map(Number);
    const pb = String(b).split(".").map(Number);
    if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return false;
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return false;
  }
  function startVersionTag() {
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(".mwia-version"))) return;
      scheduleScan();
    }).observe(document.body, { childList: true, subtree: true });
    scheduleScan();
    if (!LATEST_URL || VERSION === "dev") return;
    checkLatest();
    setInterval(checkLatest, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && Date.now() - versionTag.checked > CHECK_EVERY_MS) checkLatest();
    });
  }
  async function checkLatest() {
    versionTag.checked = Date.now();
    try {
      const response = await fetch(LATEST_URL, { cache: "no-store", signal: AbortSignal.timeout?.(3e4) });
      if (!response.ok) return;
      const latest = (await response.json()).version;
      if (typeof latest === "string") versionTag.latest = latest;
      scan();
    } catch {
    }
  }
  function scheduleScan() {
    if (versionTag.scanTimer) return;
    versionTag.scanTimer = setTimeout(() => {
      versionTag.scanTimer = null;
      scan();
    }, SCAN_MS);
  }
  function scan() {
    const name = document.querySelector(NAME);
    if (!name) return;
    const row = name.querySelector(NAME_ROW) || name;
    let tag = row.querySelector(".mwia-version");
    if (!tag) {
      tag = document.createElement("a");
      tag.className = "mwia-version";
      tag.target = "_blank";
      tag.rel = "noopener";
      tag.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!tag.classList.contains("mwia-version-old")) event.preventDefault();
      });
      row.appendChild(tag);
    }
    const old = versionTag.latest && isNewer(versionTag.latest, VERSION);
    const text = old ? `v${VERSION} \u2013 update` : `v${VERSION}`;
    if (tag.textContent !== text) tag.textContent = text;
    tag.classList.toggle("mwia-version-old", Boolean(old));
    tag.title = old ? `MWI Advisor v${versionTag.latest} is out (you have v${VERSION}): tap to update` : `MWI Advisor v${VERSION}`;
    if (old) tag.href = UPDATE_URL;
    else tag.removeAttribute("href");
  }

  // src/sim-cache.js
  var DB_NAME2 = "mwia-sim-cache";
  var RUNS = "runs";
  var META2 = "meta";
  var MAX_ENTRIES = 2e4;
  var OLD_STORE = "mwia-sim-cache";
  var fingerprint = { tables: null, value: "" };
  var memory = null;
  var opening = null;
  function hash(text) {
    let h1 = 3735928559;
    let h22 = 1103547991;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h22 = Math.imul(h22 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h22 ^ h22 >>> 13, 3266489909);
    h22 = Math.imul(h22 ^ h22 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
    return (4294967296 * (2097151 & h22) + (h1 >>> 0)).toString(36);
  }
  function generation() {
    const tables = engineTables();
    const sameData = fingerprint.tables && Object.keys(tables).every((k) => tables[k] === fingerprint.tables[k]);
    if (!sameData) fingerprint = { tables, value: hash(JSON.stringify(tables)) };
    return scriptVersion() + "|" + fingerprint.value;
  }
  function jobKey(job) {
    const { telemetry, ...rest } = job;
    return hash(JSON.stringify(rest));
  }
  var request2 = (req) => new Promise((resolve2, reject) => {
    req.onsuccess = () => resolve2(req.result);
    req.onerror = () => reject(req.error);
  });
  var finished = (tx) => new Promise((resolve2, reject) => {
    tx.oncomplete = resolve2;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  function dropOldStore() {
    try {
      globalThis.localStorage?.removeItem(OLD_STORE);
    } catch {
    }
  }
  function open(gen) {
    opening || (opening = (async () => {
      dropOldStore();
      if (!globalThis.indexedDB) return null;
      try {
        const db = await new Promise((resolve2, reject) => {
          const req = indexedDB.open(DB_NAME2, 1);
          req.onupgradeneeded = () => {
            const store5 = req.result.createObjectStore(RUNS, { keyPath: "key" });
            store5.createIndex("used", "used");
            req.result.createObjectStore(META2);
          };
          req.onsuccess = () => resolve2(req.result);
          req.onerror = () => reject(req.error);
        });
        return { db, gen: null };
      } catch {
        return null;
      }
    })());
    return opening.then(async (state2) => {
      if (!state2 || state2.gen === gen) return state2?.db || null;
      const tx = state2.db.transaction(META2, "readonly");
      const stored2 = await request2(tx.objectStore(META2).get("generation"));
      if (stored2 !== gen) {
        const wipe = state2.db.transaction([RUNS, META2], "readwrite");
        wipe.objectStore(RUNS).clear();
        wipe.objectStore(META2).put(gen, "generation");
        await finished(wipe);
      }
      state2.gen = gen;
      return state2.db;
    });
  }
  async function lookup(db, keys) {
    if (!db) {
      memory || (memory = /* @__PURE__ */ new Map());
      return keys.map((k) => memory.has(k) ? structuredClone(memory.get(k)) : null);
    }
    const store5 = db.transaction(RUNS, "readonly").objectStore(RUNS);
    return Promise.all(keys.map((k) => request2(store5.get(k)).then((v) => v ?? null)));
  }
  async function store3(db, entries) {
    if (!entries.length) return;
    if (!db) {
      memory || (memory = /* @__PURE__ */ new Map());
      for (const e2 of entries) {
        memory.delete(e2.key);
        memory.set(e2.key, structuredClone(e2));
      }
      while (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value);
      return;
    }
    const tx = db.transaction(RUNS, "readwrite");
    const runs = tx.objectStore(RUNS);
    for (const e2 of entries) runs.put(e2);
    const count3 = await request2(runs.count());
    if (count3 > MAX_ENTRIES) {
      let excess = count3 - MAX_ENTRIES + Math.round(MAX_ENTRIES / 10);
      const cursor = runs.index("used").openKeyCursor();
      cursor.onsuccess = () => {
        const c2 = cursor.result;
        if (!c2 || excess-- <= 0) return;
        runs.delete(c2.primaryKey);
        c2.continue();
      };
    }
    await finished(tx);
  }
  var clock = 0;
  var now = () => Math.max(Date.now(), ++clock);
  async function runCached(pool, jobs, onProgress) {
    let db = null;
    try {
      db = await open(generation());
    } catch {
      db = null;
    }
    const keys = jobs.map(jobKey);
    let found = [];
    try {
      found = await lookup(db, keys);
    } catch {
      found = keys.map(() => null);
    }
    const usable = (entry, job) => entry && (!job.telemetry || entry.telemetry);
    const toRun = [];
    const slotOf = /* @__PURE__ */ new Map();
    const plan = jobs.map((job, i) => {
      if (usable(found[i], job)) return { entry: found[i] };
      const key2 = keys[i];
      if (!slotOf.has(key2)) {
        slotOf.set(key2, toRun.length);
        toRun.push(job);
      } else if (job.telemetry) toRun[slotOf.get(key2)] = job;
      return { run: slotOf.get(key2) };
    });
    const kept2 = jobs.length - plan.filter((p2) => p2.run !== void 0).length;
    if (kept2) onProgress?.(kept2, jobs.length);
    const results = toRun.length ? await pool.runAll(toRun, (done2) => onProgress?.(kept2 + done2, kept2 + toRun.length)) : [];
    const used = now();
    const writes = /* @__PURE__ */ new Map();
    const out = plan.map((p2, i) => {
      if (p2.entry) {
        writes.set(keys[i], { ...p2.entry, used });
        const { result: result2, telemetry: telemetry2 } = p2.entry;
        return jobs[i].telemetry ? { ...result2, telemetry: telemetry2 } : { ...result2 };
      }
      const { telemetry, ...result } = results[p2.run];
      const entry = { key: keys[i], result, used };
      if (telemetry) entry.telemetry = telemetry;
      writes.set(keys[i], entry);
      return jobs[i].telemetry ? { ...result, telemetry } : { ...result };
    });
    store3(db, [...writes.values()]).catch(() => {
    });
    return out;
  }

  // src/triggers.js
  var SELF = "/combat_trigger_dependencies/self";
  var TARGET = "/combat_trigger_dependencies/targeted_enemy";
  var ENEMIES = "/combat_trigger_dependencies/all_enemies";
  var C = (name) => "/combat_trigger_conditions/" + name;
  var GTE = "/combat_trigger_comparators/greater_than_equal";
  var LTE = "/combat_trigger_comparators/less_than_equal";
  var MAX_CONDITIONS = 4;
  var SHARE = 0.1;
  var whole = (x) => Math.max(1, Math.round(x));
  var median2 = (list) => {
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => a - b);
    return sorted[sorted.length >> 1];
  };
  function cleanTriggers(list) {
    return (list || []).map((t4) => ({ dependencyHrid: t4.dependencyHrid, conditionHrid: t4.conditionHrid, comparatorHrid: t4.comparatorHrid, value: t4.value ?? 0 }));
  }
  function abilityTriggers(profile, hrid, data) {
    return cleanTriggers(profile.abilityTriggers?.[hrid] || data.abilityDetailMap[hrid]?.defaultCombatTriggers);
  }
  function consumableTriggers(profile, hrid, data) {
    return cleanTriggers(profile.consumableTriggers?.[hrid] || data.itemDetailMap[hrid]?.consumableDetail?.defaultCombatTriggers);
  }
  var triggersKey = (list) => cleanTriggers(list).map((t4) => [t4.dependencyHrid, t4.conditionHrid, t4.comparatorHrid, t4.value].join(":")).sort().join("|");
  function mergeTelemetry(list) {
    var _a, _b;
    const out = { abilities: {}, consumables: {}, maxEnemies: 0, deaths: 0, deathsFoodWaiting: 0, hours: 0 };
    for (const t4 of list.filter(Boolean)) {
      out.maxEnemies = Math.max(out.maxEnemies, t4.maxEnemies);
      out.deaths += t4.deaths;
      out.deathsFoodWaiting += t4.deathsFoodWaiting;
      out.hours += t4.hours;
      for (const [hrid, s2] of Object.entries(t4.abilities)) {
        const o2 = (_a = out.abilities)[hrid] || (_a[hrid] = { casts: 0, blocked: 0, enemiesAtCast: {}, hits: 0, hitDamage: 0, kills: [], healed: 0, overheal: 0, heals: 0, healSamples: [] });
        for (const k of ["casts", "blocked", "hits", "hitDamage", "healed", "overheal", "heals"]) o2[k] += s2[k];
        for (const [n5, count3] of Object.entries(s2.enemiesAtCast)) o2.enemiesAtCast[n5] = (o2.enemiesAtCast[n5] || 0) + count3;
        o2.kills.push(...s2.kills);
        o2.healSamples.push(...s2.healSamples);
      }
      for (const [hrid, s2] of Object.entries(t4.consumables)) {
        const o2 = (_b = out.consumables)[hrid] || (_b[hrid] = { uses: 0, restore: 0, wasted: 0 });
        for (const k of ["uses", "restore", "wasted"]) o2[k] += s2[k];
      }
    }
    return out;
  }
  function effectTypes(ability) {
    return (ability?.abilityEffects || []).map((e2) => e2.effectType.split("/").pop() + ":" + e2.targetType);
  }
  function setCondition(list, dependencyHrid, conditionHrid, comparatorHrid, value) {
    const rest = list.filter((t4) => !(t4.dependencyHrid === dependencyHrid && t4.conditionHrid === conditionHrid));
    return [...rest, { dependencyHrid, conditionHrid, comparatorHrid, value }];
  }
  function valueOf(list, dependencyHrid, conditionHrid, comparatorHrid) {
    return list.find((t4) => t4.dependencyHrid === dependencyHrid && t4.conditionHrid === conditionHrid && t4.comparatorHrid === comparatorHrid)?.value ?? null;
  }
  function triggerChanges(profile, battle, telemetry, data, options = {}) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (target, hrid, was, triggers, rule, why) => {
      if (triggers.length > MAX_CONDITIONS) return;
      const key2 = hrid + "|" + triggersKey(triggers);
      if (triggersKey(triggers) === triggersKey(was) || seen.has(key2)) return;
      seen.add(key2);
      out.push({ target, hrid, triggers, was, rule, why });
    };
    const stats = (hrid) => telemetry.abilities[hrid] || { casts: 0, blocked: 0, enemiesAtCast: {}, hits: 0, hitDamage: 0, kills: [], healed: 0, overheal: 0, heals: 0, healSamples: [] };
    const cost = (hrid) => data.abilityDetailMap[hrid]?.manaCost || 0;
    const onlyHrids = options.only ? new Set(options.only) : null;
    const starved = battle.filter((e2) => {
      const s2 = stats(e2.hrid);
      return s2.blocked >= 3 && s2.blocked >= SHARE * Math.max(1, s2.casts);
    });
    battle.forEach((entry, position) => {
      const hrid = entry.hrid;
      if (onlyHrids && !onlyHrids.has(hrid)) return;
      const ability = data.abilityDetailMap[hrid];
      if (!ability) return;
      const was = abilityTriggers(profile, hrid, data);
      const s2 = stats(hrid);
      const kinds = effectTypes(ability);
      const later = battle.slice(position + 1);
      if (starved.includes(entry) && later.some((e2) => cost(e2.hrid) < cost(hrid)) && !(valueOf(was, SELF, C("current_mp"), GTE) >= cost(hrid))) {
        add("ability", hrid, was, setCondition(was, SELF, C("current_mp"), GTE, cost(hrid)), "mana", { blocked: s2.blocked, casts: s2.casts });
      }
      const above = battle.slice(0, position).filter((e2) => starved.includes(e2) && cost(e2.hrid) > 0);
      if (above.length && s2.casts > 0 && cost(hrid) > 0) {
        const first = above.sort((a, b) => stats(b.hrid).blocked - stats(a.hrid).blocked)[0];
        add("ability", hrid, was, setCondition(was, SELF, C("current_mp"), GTE, cost(first.hrid) + cost(hrid)), "reserve", { for: first.hrid, blocked: stats(first.hrid).blocked });
      }
      if (kinds.includes("damage:enemy") && !kinds.includes("damage:allEnemies") && s2.hits > 0) {
        const typical = s2.hitDamage / s2.hits;
        const wasted = s2.kills.filter((hp) => hp < 0.5 * typical).length;
        if (typical >= 2 && wasted >= SHARE * Math.max(1, s2.casts)) {
          for (const factor of [0.5, 1]) {
            add("ability", hrid, was, setCondition(was, TARGET, C("current_hp"), GTE, whole(factor * typical)), "overkill", { typical: Math.round(typical), wasted, casts: s2.casts });
          }
        }
      }
      if (kinds.includes("damage:allEnemies") && telemetry.maxEnemies >= 2) {
        const now2 = valueOf(was, ENEMIES, C("number_of_active_units"), GTE) ?? 1;
        const castsBelow = (k) => Object.entries(s2.enemiesAtCast).reduce((sum, [n5, count3]) => sum + (Number(n5) < k ? count3 : 0), 0);
        for (let k = 1; k <= telemetry.maxEnemies; k++) {
          if (k === now2) continue;
          if (k > now2 && castsBelow(k) < SHARE * Math.max(1, s2.casts)) continue;
          add("ability", hrid, was, setCondition(was, ENEMIES, C("number_of_active_units"), GTE, k), "aoe", { from: now2, to: k });
        }
      }
      if (kinds.some((k) => k.startsWith("heal:")) && (s2.heals > 0 || s2.blocked > 0)) {
        const typical = median2(s2.healSamples) ?? (s2.heals ? s2.healed / s2.heals : null);
        if (typical >= 2) {
          const hpConditions = [C("current_hp"), C("missing_hp"), C("lowest_hp_percentage")];
          const base = was.filter((t4) => !hpConditions.includes(t4.conditionHrid));
          const now2 = valueOf(was, SELF, C("missing_hp"), GTE);
          for (const factor of [0.5, 1, 2]) {
            const value = whole(factor * typical);
            if (now2 !== null && Math.abs(value - now2) <= 0.1 * Math.max(now2, 1)) continue;
            add("ability", hrid, was, [...base, { dependencyHrid: SELF, conditionHrid: C("missing_hp"), comparatorHrid: GTE, value }], "heal", { typical: Math.round(typical), overheal: s2.overheal, heals: s2.heals });
          }
        }
      }
    });
    const blockedTotal = battle.reduce((sum, e2) => sum + stats(e2.hrid).blocked, 0);
    const castsTotal = battle.reduce((sum, e2) => sum + stats(e2.hrid).casts, 0);
    for (const hrid of new Set((options.food || []).filter(Boolean))) {
      if (onlyHrids && !onlyHrids.has(hrid)) continue;
      const detail = data.itemDetailMap[hrid]?.consumableDetail;
      const used = telemetry.consumables[hrid]?.uses || 0;
      if (!detail || !used) continue;
      const was = consumableTriggers(profile, hrid, data);
      for (const [condition, restore3, short3] of [
        [C("missing_hp"), detail.hitpointRestore, telemetry.deaths > 0],
        [C("missing_mp"), detail.manapointRestore, blockedTotal >= SHARE * Math.max(1, castsTotal)]
      ]) {
        if (!(restore3 > 0)) continue;
        const now2 = valueOf(was, SELF, condition, GTE);
        if (now2 === null) continue;
        const value = short3 ? whole(now2 / 2) : whole(now2 * 1.5);
        if (value !== now2) add("food", hrid, was, setCondition(was, SELF, condition, GTE, value), "food", { earlier: short3, deaths: telemetry.deaths, blocked: blockedTotal });
      }
    }
    return out;
  }
  var SHORT = { current_hp: "HP", current_mp: "MP", missing_hp: "missing HP", missing_mp: "missing MP", lowest_hp_percentage: "lowest HP %" };
  function describeTrigger(t4, data) {
    const name = t4.conditionHrid.split("/").pop();
    const condition = data.combatTriggerConditionDetailMap?.[t4.conditionHrid];
    const comparator = data.combatTriggerComparatorDetailMap?.[t4.comparatorHrid];
    const side = t4.dependencyHrid === ENEMIES ? "enemies" : "allies";
    const sign = t4.comparatorHrid === GTE ? "\u2265" : t4.comparatorHrid === LTE ? "\u2264" : null;
    if (name === "number_of_active_units") return `${side} up ${sign} ${t4.value}`;
    if (name === "number_of_dead_units") return `${side} dead ${sign} ${t4.value}`;
    const who = { [SELF]: "own", [TARGET]: "target's" }[t4.dependencyHrid] ?? (name === "lowest_hp_percentage" ? side + "'" : side + "' total");
    const what = SHORT[name] || condition?.name || name;
    if (!sign) return `${who} ${what} ${(comparator?.name || "").toLowerCase()}`.trim();
    return `${who} ${what} ${sign} ${t4.value}`;
  }
  function describeTriggers(list, data) {
    const shown = cleanTriggers(list);
    return shown.length ? shown.map((t4) => describeTrigger(t4, data)).join(" and ") : "always";
  }

  // src/analysis.js
  var ACCURACY = {
    fast: { label: "Fast", hours: 1, seeds: 3 },
    normal: { label: "Normal", hours: 2, seeds: 4 },
    thorough: { label: "Thorough", hours: 4, seeds: 6 }
  };
  var CONFIDENCE_LEVEL = 0.9;
  var MAX_SEED_FACTOR = 3;
  var BASE_SEED_FACTOR = 3;
  var MAX_REFINED = 40;
  var REFINE_BELOW = 0.99;
  var seedFor = (index) => Math.imul(index + 1, 2654435761) >>> 1 || 1;
  var SPENDING = {
    frugal: { label: "Frugal", minPctPerMillion: 10 },
    balanced: { label: "Balanced", minPctPerMillion: 3 },
    all: { label: "All in", minPctPerMillion: 0 }
  };
  var STYLE_STATS = {
    melee: ["stabAccuracy", "slashAccuracy", "smashAccuracy", "stabDamage", "slashDamage", "smashDamage", "meleeExperience", "defensiveDamage"],
    ranged: ["rangedAccuracy", "rangedDamage", "rangedExperience"],
    magic: ["magicAccuracy", "magicDamage", "magicExperience"]
  };
  var PHYSICAL_STATS = ["physicalAmplify", "armorPenetration"];
  function offStyleStats(style) {
    const own = /* @__PURE__ */ new Set([...STYLE_STATS[style], ...style === "magic" ? [] : PHYSICAL_STATS]);
    return new Set([...Object.values(STYLE_STATS).flat(), ...PHYSICAL_STATS].filter((stat) => !own.has(stat)));
  }
  var MIN_GOLD_REF = 1e3;
  function xpValue(result, settings2) {
    return settings2?.countLevels && result.levels !== null && result.levels !== void 0 ? result.levels : result.xpTotal;
  }
  function makeGoal(settings2, reference) {
    return {
      countLevels: !!settings2.countLevels,
      gold: Math.min(1, Math.max(0, Number(settings2.goldWeight) || 0)),
      xpRef: Math.max(settings2.countLevels ? 1e-6 : 1, reference.xp),
      goldRef: Math.max(MIN_GOLD_REF, reference.gold)
    };
  }
  function score(result, goal) {
    return (1 - goal.gold) * xpValue(result, goal) / goal.xpRef + goal.gold * result.profit / goal.goldRef;
  }
  var RARE_DEATHS_PER_HOUR = 0.5;
  function deathLimit(settings2) {
    return settings2.acceptRareDeaths ? RARE_DEATHS_PER_HOUR : 0;
  }
  var acceptable = (result, settings2) => result.deaths <= deathLimit(settings2);
  function zoneGoal(zoneResults, settings2) {
    const safe = zoneResults.filter((z) => acceptable(z.result, settings2));
    const pool = safe.length ? safe : zoneResults;
    return makeGoal(settings2, {
      xp: Math.max(...pool.map((z) => xpValue(z.result, settings2))),
      gold: Math.max(...pool.map((z) => z.result.loot))
    });
  }
  function consumableCost(result) {
    let cost = 0;
    for (const [hrid, perHour] of Object.entries(result.consumables)) cost += perHour * (askPrice(hrid) ?? sellValue(hrid));
    return cost;
  }
  function lootValue(result, tier) {
    let value = 0;
    for (const [monster, perHour] of Object.entries(result.kills)) value += perHour * expectedLootPerKill(monster, tier, result);
    return value;
  }
  function average(results) {
    const n5 = results.length;
    const mean = (pick2) => results.reduce((sum, r) => sum + pick2(r), 0) / n5;
    const meanMap = (pick2) => {
      const out = {};
      for (const r of results) for (const [k, v] of Object.entries(pick2(r))) out[k] = (out[k] || 0) + v / n5;
      return out;
    };
    return {
      ...results[0],
      xp: meanMap((r) => r.xp),
      xpTotal: mean((r) => r.xpTotal),
      deaths: mean((r) => r.deaths),
      encounters: mean((r) => r.encounters),
      kills: meanMap((r) => r.kills),
      consumables: meanMap((r) => r.consumables),
      manaUsed: meanMap((r) => r.manaUsed)
    };
  }
  var ENEMY_RESPAWN_SECONDS = 3;
  var MAX_ENCOUNTERS_PER_HOUR = 3600 / ENEMY_RESPAWN_SECONDS;
  function isSpawnCapped(result) {
    return result.encounters >= 0.85 * MAX_ENCOUNTERS_PER_HOUR;
  }
  function combatLevelsPerHour(result, profile) {
    const table = getClientData()?.levelExperienceTable;
    if (!Array.isArray(table) || !profile) return null;
    const skills = {};
    for (const [skill, level] of Object.entries(profile.levels)) skills[skill] = { level, xp: profile.allExperience?.["/skills/" + skill] ?? null };
    return levelsPerHour(table, skills, result.xp);
  }
  function enrich(result, tier, profile) {
    const loot = lootValue(result, tier);
    const cost = consumableCost(result);
    return { ...result, loot, cost, profit: loot - cost, levels: combatLevelsPerHour(result, profile), killsTotal: Object.values(result.kills).reduce((a, b) => a + b, 0) };
  }
  async function simulateRuns(pool, items, zone, hours, onProgress) {
    const data = getClientData();
    const jobs = [];
    for (const item of items) {
      const player = toDTO(item.profile, data);
      for (const seed of item.seeds) {
        const job = { player, zoneHrid: zone.zoneHrid, tier: zone.tier, hours, seed: seedFor(seed), extraBuffs: item.profile.extraBuffs };
        jobs.push(item.telemetry ? { ...job, telemetry: true } : job);
      }
    }
    const results = await runCached(pool, jobs, onProgress);
    let next = 0;
    return items.map(
      (item) => item.seeds.map((seed) => {
        const { telemetry, ...result } = results[next++];
        if (item.telemetry) (item.telemetryOut || (item.telemetryOut = [])).push(telemetry);
        return { ...enrich(result, zone.tier, item.profile), seed };
      })
    );
  }
  var summarize3 = (runs, tier, profile) => enrich(average(runs), tier, profile);
  async function simulateVariants(pool, variants, zone, settings2, onProgress) {
    const seeds = Array.from({ length: settings2.seeds }, (_, i) => i);
    const runs = await simulateRuns(pool, variants.map((v) => ({ profile: v.profile, seeds })), zone, settings2.hours, onProgress);
    return variants.map((variant, i) => ({ ...variant, result: summarize3(runs[i], zone.tier, variant.profile), runs: runs[i] }));
  }
  async function analyzeZones(pool, profile, settings2, onProgress) {
    const variants = [];
    for (const zone of combatZones()) {
      for (let tier = 0; tier <= Math.min(settings2.maxTier, zone.maxDifficulty ?? 0); tier++) {
        variants.push({ zone: { zoneHrid: zone.hrid, tier } });
      }
    }
    const data = getClientData();
    const player = toDTO(profile, data);
    const hours = Math.max(1, settings2.hours / 2);
    const jobs = variants.map((v) => ({ player, zoneHrid: v.zone.zoneHrid, tier: v.zone.tier, hours, seed: seedFor(0), extraBuffs: profile.extraBuffs }));
    const results = await runCached(pool, jobs, onProgress);
    return variants.map((v, i) => ({ ...v, result: enrich(results[i], v.zone.tier, profile) }));
  }
  function pickBestZone(zoneResults, settings2) {
    if (!zoneResults?.length) return null;
    const goal = zoneGoal(zoneResults, settings2);
    const sorted = [...zoneResults].sort((a, b) => score(b.result, goal) - score(a.result, goal));
    return sorted.find((z) => acceptable(z.result, settings2)) || sorted[0];
  }
  function switchStyle(profile, style, budget) {
    const data = getClientData();
    if (!style || style === weaponStyle(profile, data)) return { profile, starter: null };
    const fits = (item) => styleOfItem(item) === style && item.equipmentDetail.combatStats.primaryTraining === "/skills/" + style && meetsRequirements(profile, item.equipmentDetail.levelRequirements);
    const weapons = new Map(Object.values(data.itemDetailMap).filter(fits).map((item) => [item.hrid, item]));
    const owned = profile.inventory.filter((i) => weapons.has(i.hrid)).sort((a, b) => (weapons.get(b.hrid).itemLevel || 0) - (weapons.get(a.hrid).itemLevel || 0) || b.enhancementLevel - a.enhancementLevel)[0];
    let starter = null;
    if (owned) {
      starter = { hrid: owned.hrid, enhancementLevel: owned.enhancementLevel, cost: 0, owned: true };
    } else {
      for (const item of weapons.values()) {
        const price = askPrice(item.hrid, 0);
        if (price === null || price > budget) continue;
        if (!starter || price < starter.cost) starter = { hrid: item.hrid, enhancementLevel: 0, cost: price, owned: false };
      }
    }
    if (!starter) return { profile, starter: null, missing: style };
    const variant = cloneProfile(profile);
    starter.slot = data.itemDetailMap[starter.hrid].equipmentDetail.type.split("/").pop();
    starter.replaces = weaponOf(profile);
    equip(variant, starter.slot, { hrid: starter.hrid, enhancementLevel: starter.enhancementLevel });
    return { profile: variant, starter };
  }
  function isUsefulFor(style, stats) {
    const offStyle = offStyleStats(style);
    return Object.entries(stats || {}).some(([key2, value]) => typeof value === "number" && value > 0 && !offStyle.has(key2) && key2 !== "attackInterval");
  }
  function displaced(profile, type, starter) {
    const slots = type === "two_hand" ? ["two_hand", "main_hand", "off_hand"] : type === "main_hand" ? ["main_hand", "two_hand"] : [type];
    return slots.filter((slot) => profile.equipment[slot] && !(starter && (slot === "main_hand" || slot === "two_hand"))).map((slot) => profile.equipment[slot]);
  }
  function resaleOf(gear, data) {
    const bid = marketEntry(gear.hrid, gear.enhancementLevel)?.b;
    return resaleValue(gear.hrid, gear.enhancementLevel, bid > 0 ? bid : null, data, marketBids).value;
  }
  function gearCandidates(profile, settings2) {
    const { budget, starter = null, enhanceCost = null } = settings2;
    const data = getClientData();
    const style = weaponStyle(profile, data);
    const candidates = [];
    for (const item of Object.values(data.itemDetailMap)) {
      const detail = item.equipmentDetail;
      if (!detail) continue;
      const type = detail.type?.split("/").pop();
      if (!GEAR_TYPES.includes(type)) continue;
      if (!meetsRequirements(profile, detail.levelRequirements)) continue;
      const stats = detail.combatStats || {};
      const weapon = type === "main_hand" || type === "two_hand";
      if (weapon) {
        if (styleOfItem(item) !== style) continue;
      } else if (!isUsefulFor(style, stats)) {
        continue;
      }
      if (type === "off_hand" && profile.equipment.two_hand) continue;
      const current = profile.equipment[type];
      const worn2 = current?.hrid === item.hrid && !(starter && weapon) ? current : null;
      const taken = displaced(profile, type, starter);
      const resale = taken.reduce((sum, gear) => sum + resaleOf(gear, data), 0);
      let options = gearOptions(profile, item.hrid, budget, { worn: worn2, enhanceCost, resale });
      if (type === "pouch") options = options.slice(0, 1);
      for (const option of options) {
        if (current && current.hrid === item.hrid && current.enhancementLevel >= option.enhancementLevel) continue;
        const gear = { hrid: item.hrid, enhancementLevel: option.enhancementLevel };
        const variant = cloneProfile(profile);
        equip(variant, type, gear);
        if (type === "pouch") {
          const before = slotCounts(profile, data);
          const after = slotCounts(variant, data);
          if (after.food < before.food || after.drinks < before.drinks) continue;
        }
        const candidate = {
          kind: "gear",
          slot: type,
          hrid: item.hrid,
          enhancementLevel: option.enhancementLevel,
          price: option.price,
          resale: option.resale,
          sold: option.resale ? taken : [],
          cost: option.cost,
          owned: option.owned,
          enhance: option.enhance || null,
          replaces: current || null,
          profile: variant
        };
        candidates.push(candidate);
        const foodSlotsNow = slotCounts(profile, data).food;
        if (type === "pouch" && slotCounts(variant, data).food > foodSlotsNow) {
          for (const food of combatConsumables("food")) {
            if (profile.food.slice(0, foodSlotsNow).some((had) => sameKind(had, food, data))) continue;
            const withFood = cloneProfile(variant);
            while (withFood.food.length <= foodSlotsNow) withFood.food.push(null);
            withFood.food[foodSlotsNow] = food;
            candidates.push({ ...candidate, extraFood: food, extraFoodSlot: foodSlotsNow, profile: withFood });
          }
        }
      }
    }
    return candidates;
  }
  var MAX_LEVELS = 5;
  function gearOptions(profile, hrid, budget, { worn: worn2 = null, enhanceCost = null, resale = 0 } = {}) {
    const owned = profile.inventory.filter((i) => i.hrid === hrid).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
    const options = owned ? [{ enhancementLevel: owned.enhancementLevel, price: 0, resale, cost: 0, owned: true }] : [];
    const cheapest = /* @__PURE__ */ new Map();
    const offer = (o2) => {
      o2.price = o2.cost;
      o2.resale = o2.enhance?.start === "worn" ? 0 : resale;
      o2.cost = Math.max(0, o2.price - o2.resale);
      if (o2.cost > budget || owned && o2.enhancementLevel <= owned.enhancementLevel) return;
      const known = cheapest.get(o2.enhancementLevel);
      if (!known || o2.cost < known.cost) cheapest.set(o2.enhancementLevel, o2);
    };
    for (const listing of marketListings(hrid)) offer({ enhancementLevel: listing.enhancementLevel, cost: listing.price, owned: false });
    if (enhanceCost) {
      const starts = [];
      if (worn2) starts.push({ from: worn2.enhancementLevel, base: 0, start: "worn" });
      if (owned) starts.push({ from: owned.enhancementLevel, base: 0, start: "owned" });
      const ask = askPrice(hrid, 0);
      if (ask !== null) starts.push({ from: 0, base: ask, start: "buy" });
      const lookup2 = starts.length ? enhanceCost(hrid, starts.map((s2) => s2.from)) : null;
      for (let target = 1; lookup2 && target <= MAX_TARGET; target++) {
        for (const s2 of starts) {
          const made = s2.from < target ? lookup2(s2.from, target) : null;
          if (made) offer({ enhancementLevel: target, cost: s2.base + made.cost, owned: false, enhance: { ...made, from: s2.from, start: s2.start, basePrice: s2.base } });
        }
      }
    }
    const front = [];
    for (const o2 of [...cheapest.values()].sort((a, b) => a.cost - b.cost || b.enhancementLevel - a.enhancementLevel)) {
      if (front.length && o2.enhancementLevel <= front[front.length - 1].enhancementLevel) continue;
      front.push(o2);
    }
    let picked = front;
    if (front.length > MAX_LEVELS) {
      const step = (front.length - 1) / (MAX_LEVELS - 1);
      picked = Array.from({ length: MAX_LEVELS }, (_, i) => front[Math.round(i * step)]);
    }
    return [...options, ...picked];
  }
  function combatConsumables(kind) {
    const category = kind === "food" ? "/item_categories/food" : "/item_categories/drink";
    return Object.values(getClientData().itemDetailMap).filter((item) => item.categoryHrid === category && item.consumableDetail?.usableInActionTypeMap?.["/action_types/combat"]).filter((item) => askPrice(item.hrid, 0) !== null).map((item) => item.hrid);
  }
  function abilityCandidates(profile, budget, replace = null) {
    const data = getClientData();
    const slots = slotCounts(profile, data);
    if (slots.abilities === 0) return [];
    const books = {};
    for (const item of Object.values(data.itemDetailMap)) {
      if (item.abilityBookDetail) books[item.abilityBookDetail.abilityHrid] = item;
    }
    const equipped = new Set(profile.abilities.filter(Boolean).map((a) => a.hrid));
    const indices = [];
    for (let i = 1; i <= slots.abilities; i++) indices.push(i);
    const empty = indices.filter((i) => !profile.abilities[i]);
    const placements = empty.length ? [empty[0]] : replace && profile.abilities[replace] ? [replace] : indices;
    const candidates = [];
    for (const ability of Object.values(data.abilityDetailMap)) {
      if (ability.isSpecialAbility || equipped.has(ability.hrid)) continue;
      let level = profile.learnedAbilities[ability.hrid];
      let cost = 0;
      const book = books[ability.hrid];
      if (!level) {
        if (!book || !meetsRequirements(profile, book.abilityBookDetail.levelRequirements)) continue;
        const price = askPrice(book.hrid, 0);
        if (price === null || price > budget) continue;
        level = 1;
        cost = price;
      }
      for (const index of placements) {
        const variant = cloneProfile(profile);
        variant.abilities[index] = { hrid: ability.hrid, level };
        candidates.push({
          kind: "ability",
          slot: "ability" + index,
          hrid: ability.hrid,
          bookHrid: book?.hrid,
          level,
          cost,
          owned: cost === 0,
          replaces: profile.abilities[index]?.hrid || null,
          profile: variant
        });
      }
    }
    return [...candidates, ...abilityLevelCandidates(profile, budget, books)];
  }
  var LEVEL_STEPS = [1, 2, 3, 5, 10, 20];
  function abilityLevelCandidates(profile, budget, books) {
    const data = getClientData();
    const table = data.levelExperienceTable;
    if (!table) return [];
    const slots = slotCounts(profile, data);
    const candidates = [];
    profile.abilities.forEach((entry, index) => {
      if (!entry || (index === 0 ? !slots.special : index > slots.abilities)) return;
      const book = books[entry.hrid];
      const xpPerBook = book?.abilityBookDetail?.experienceGain;
      const price = book && askPrice(book.hrid, 0);
      if (!xpPerBook || !price) return;
      const xpNow = profile.abilityExperience[entry.hrid] ?? table[entry.level] ?? 0;
      for (const step of LEVEL_STEPS) {
        const target = entry.level + step;
        if (table[target] === void 0) break;
        const count3 = Math.max(1, Math.ceil((table[target] - xpNow) / xpPerBook));
        if (count3 * price > budget) break;
        const variant = cloneProfile(profile);
        variant.abilities[index] = { hrid: entry.hrid, level: target };
        candidates.push({
          kind: "abilityLevel",
          slot: "ability" + index,
          hrid: entry.hrid,
          bookHrid: book.hrid,
          fromLevel: entry.level,
          level: target,
          books: count3,
          cost: count3 * price,
          owned: false,
          replaces: null,
          profile: variant
        });
      }
    });
    return candidates;
  }
  function stylesInUse(profile, data) {
    const styles = /* @__PURE__ */ new Set([weaponStyle(profile, data)]);
    const ofHrid = (hrid) => hrid === "/combat_styles/ranged" ? "ranged" : hrid === "/combat_styles/magic" ? "magic" : hrid ? "melee" : null;
    for (const hrid of Object.keys(profile.learnedAbilities || {})) {
      for (const effect of data.abilityDetailMap[hrid]?.abilityEffects || []) if (ofHrid(effect.combatStyleHrid)) styles.add(ofHrid(effect.combatStyleHrid));
    }
    return styles;
  }
  function useless(hrid, styles, data) {
    const buffs = data.itemDetailMap[hrid]?.consumableDetail?.buffs || [];
    const style = (b) => /\/buff_types\/(melee|ranged|magic)_level$/.exec(b.typeHrid || "")?.[1];
    return buffs.length > 0 && buffs.every((b) => style(b) && !styles.has(style(b)));
  }
  function consumableCandidates(profile, kind, { onlyUseful = false, replace = null } = {}) {
    const data = getClientData();
    const styles = onlyUseful ? stylesInUse(profile, data) : null;
    const slots = slotCounts(profile, data);
    const count3 = kind === "food" ? slots.food : slots.drinks;
    const current = (kind === "food" ? profile.food : profile.drinks).slice(0, count3);
    while (current.length < count3) current.push(null);
    const empty = current.findIndex((h3) => !h3);
    const placements = empty !== -1 ? [empty] : replace !== null && current[replace] ? [replace] : current.map((_, i) => i);
    const candidates = [];
    for (const hrid of combatConsumables(kind)) {
      if (current.includes(hrid) || styles && useless(hrid, styles, data)) continue;
      const clash = current.findIndex((had) => sameKind(had, hrid, data));
      for (const index of clash !== -1 ? [clash] : placements) {
        const variant = cloneProfile(profile);
        const list = kind === "food" ? variant.food : variant.drinks;
        while (list.length < count3) list.push(null);
        list[index] = hrid;
        candidates.push({ kind, slot: kind + index, hrid, cost: 0, replaces: current[index] || null, profile: variant });
      }
    }
    current.forEach((hrid, index) => {
      if (!hrid) return;
      const variant = cloneProfile(profile);
      (kind === "food" ? variant.food : variant.drinks)[index] = null;
      candidates.push({ kind, remove: true, slot: kind + index, hrid, cost: 0, replaces: hrid, profile: variant });
    });
    return candidates;
  }
  function houseCandidates(profile, budget) {
    const data = getClientData();
    const candidates = [];
    for (const room of Object.values(data.houseRoomDetailMap || {})) {
      if (!room.usableInActionTypeMap?.["/action_types/combat"]) continue;
      const level = profile.houseRooms?.[room.hrid] || 0;
      const costs = room.upgradeCostsMap?.[String(level + 1)];
      if (!costs?.length) continue;
      const materials2 = costs.map((c2) => ({ hrid: c2.itemHrid, count: c2.count, price: askPrice(c2.itemHrid, 0) }));
      if (materials2.some((m2) => m2.price === null)) continue;
      const cost = materials2.reduce((sum, m2) => sum + m2.count * m2.price, 0);
      if (cost > budget) continue;
      const variant = cloneProfile(profile);
      variant.houseRooms = { ...variant.houseRooms, [room.hrid]: level + 1 };
      candidates.push({ kind: "house", slot: "house:" + room.hrid, hrid: room.hrid, name: room.name, fromLevel: level, level: level + 1, cost, materials: materials2, owned: false, replaces: null, profile: variant });
    }
    return candidates;
  }
  var SKILL_STEPS = [1, 5];
  function skillLevelCandidates(profile) {
    const data = getClientData();
    const style = weaponStyle(profile, data);
    const top = Array.isArray(data.levelExperienceTable) ? data.levelExperienceTable.length - 1 : 200;
    const candidates = [];
    for (const skill of COMBAT_SKILLS) {
      if (["melee", "ranged", "magic"].includes(skill) && skill !== style) continue;
      const from = profile.levels[skill];
      for (const step of SKILL_STEPS) {
        if (from + step > top) break;
        const variant = cloneProfile(profile);
        variant.levels[skill] = from + step;
        candidates.push({ kind: "skillLevel", slot: "skill:" + skill, hrid: skill, fromLevel: from, level: from + step, cost: 0, owned: true, replaces: null, profile: variant });
      }
    }
    return candidates;
  }
  function abilityOrderCandidates(profile) {
    const data = getClientData();
    const slots = slotCounts(profile, data);
    const indices = [];
    for (let i = 1; i <= slots.abilities; i++) if (profile.abilities[i]) indices.push(i);
    if (indices.length < 2) return [];
    const entries = indices.map((i) => profile.abilities[i]);
    const keyOf2 = (list) => list.map((e2) => e2.hrid).join(">");
    const now2 = battleAbilityOrder(profile, data);
    const seen = /* @__PURE__ */ new Set([keyOf2(now2)]);
    const candidates = [];
    for (const permuted of permutations(entries)) {
      const order = battleAbilityOrder({ ...profile, abilities: [null, ...permuted] }, data);
      const key2 = keyOf2(order);
      if (seen.has(key2)) continue;
      seen.add(key2);
      const variant = cloneProfile(profile);
      indices.forEach((slot, k) => variant.abilities[slot] = { ...order[k] });
      candidates.push({ kind: "abilityOrder", slot: "abilityOrder", hrid: key2, order: order.map((e2) => e2.hrid), was: now2.map((e2) => e2.hrid), cost: 0, owned: true, replaces: null, profile: variant });
    }
    return candidates;
  }
  function permutations(list) {
    if (list.length <= 1) return [list];
    return list.flatMap((item, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [item, ...rest]));
  }
  function bestPerItem(evaluated) {
    const groups = /* @__PURE__ */ new Map();
    for (const c2 of evaluated) {
      const key2 = [c2.kind, c2.hrid, c2.enhancementLevel ?? "", ["abilityLevel", "house", "skillLevel"].includes(c2.kind) ? c2.level : "", c2.remove ? "remove" : ""].join("|");
      if (!groups.has(key2)) groups.set(key2, []);
      groups.get(key2).push(c2);
    }
    return [...groups.values()].map((options) => {
      const pool = options.some((c2) => c2.safe) ? options.filter((c2) => c2.safe) : options;
      const top = pool.reduce((a, b) => b.delta > a.delta ? b : a);
      if (!top.extraFood || top.delta <= 0) return top;
      return pool.filter((c2) => c2.delta >= 0.85 * top.delta).sort((a, b) => a.costPerHourDelta - b.costPerHourDelta)[0];
    });
  }
  function triggerCandidates(profile, telemetry, only = null) {
    const data = getClientData();
    const slots = slotCounts(profile, data);
    const changes = triggerChanges(profile, battleAbilityOrder(profile, data), telemetry, data, { food: profile.food.slice(0, slots.food), only });
    return changes.map((change) => ({ change, profile: withTriggers(profile, change) }));
  }
  function withTriggers(profile, change) {
    const variant = cloneProfile(profile);
    const map = change.target === "ability" ? "abilityTriggers" : "consumableTriggers";
    variant[map] = { ...variant[map] || {}, [change.hrid]: change.triggers };
    return variant;
  }
  var SCREEN_MARGIN = 0.01;
  var SCREEN_BELOW = 0.02;
  var NOT_SCREENED = /* @__PURE__ */ new Set(["skillLevel"]);
  function screenGoals(base, settings2) {
    const ends = [{ goldWeight: 0, countLevels: false }, { goldWeight: 1, countLevels: false }];
    if (base.levels !== null && base.levels !== void 0) ends.push({ goldWeight: 0, countLevels: true });
    return ends.map((end) => {
      const s2 = { ...settings2, ...end };
      return makeGoal(s2, { xp: xpValue(base, s2), gold: base.loot });
    });
  }
  function ruledOut(run, baseRuns, goals) {
    return goals.every((goal) => (confidenceOneRun(score(run, goal), baseRuns.map((r) => score(r, goal)), SCREEN_MARGIN) ?? 1) < SCREEN_BELOW);
  }
  async function simulateScreened(pool, candidates, items, baseRuns, base, zone, settings2, onProgress) {
    if (settings2.seeds < 2) return simulateRuns(pool, items, zone, settings2.hours, onProgress);
    const goals = screenGoals(base, settings2);
    const firstItems = items.map((item) => ({ ...item, seeds: item.seeds.slice(0, 1) }));
    let total = items.reduce((sum, item) => sum + item.seeds.length, 0);
    const first = await simulateRuns(pool, firstItems, zone, settings2.hours, (done2) => onProgress?.(done2, total));
    const keep2 = items.map((item, i) => item.seeds.length < 2 || NOT_SCREENED.has(candidates[i].kind) || !ruledOut(first[i][0], baseRuns, goals));
    const restItems = items.map((item, i) => keep2[i] ? { ...item, seeds: item.seeds.slice(1) } : null).filter(Boolean);
    const done0 = firstItems.length;
    total = done0 + restItems.reduce((sum, item) => sum + item.seeds.length, 0);
    const rest = await simulateRuns(pool, restItems, zone, settings2.hours, (done2) => onProgress?.(done0 + done2, total));
    let r = 0;
    return items.map((item, i) => {
      if (item.telemetry) item.telemetryOut = [...firstItems[i].telemetryOut || []];
      if (!keep2[i]) {
        candidates[i].screened = true;
        return first[i];
      }
      const restItem = restItems[r];
      const runs = [...first[i], ...rest[r++]];
      if (item.telemetry) item.telemetryOut.push(...restItem.telemetryOut || []);
      return runs;
    });
  }
  var TUNED_ABILITIES = 3;
  async function analyzeUpgrades(pool, profile, zone, settings2, onProgress, onRefineProgress) {
    const budget = settings2.budget;
    const all = settings2.scope !== "abilities";
    const seeds = (n5) => Array.from({ length: n5 }, (_, i) => i);
    const candidates = [
      ...all ? gearCandidates(profile, settings2) : [],
      ...abilityCandidates(profile, budget),
      ...abilityOrderCandidates(profile),
      ...all ? houseCandidates(profile, budget) : [],
      ...all ? skillLevelCandidates(profile) : [],
      ...all ? consumableCandidates(profile, "drinks") : [],
      ...all ? consumableCandidates(profile, "food") : []
    ];
    const baseItem2 = { profile, seeds: seeds(settings2.seeds * BASE_SEED_FACTOR), telemetry: true };
    const planned = baseItem2.seeds.length + candidates.length * settings2.seeds;
    const [baseRuns] = await simulateRuns(pool, [baseItem2], zone, settings2.hours, (done2) => onProgress?.(done2, planned));
    const telemetry = mergeTelemetry(baseItem2.telemetryOut);
    for (const { change, profile: variant } of triggerCandidates(profile, telemetry)) {
      candidates.push(triggerCandidate(change, variant));
    }
    candidates.forEach((c2, id) => c2.id = id);
    const items = candidates.map((c2) => ({ profile: c2.profile, seeds: seeds(settings2.seeds), telemetry: c2.kind === "ability" }));
    const done0 = baseItem2.seeds.length;
    const base = summarize3(baseRuns, zone.tier, profile);
    const runs = await simulateScreened(pool, candidates, items, baseRuns, base, zone, settings2, (done2, total) => onProgress?.(done0 + done2, done0 + total));
    const simulated = candidates.map((c2, i) => ({ ...c2, result: summarize3(runs[i], zone.tier, c2.profile), runs: runs[i], telemetry: items[i].telemetry ? mergeTelemetry(items[i].telemetryOut) : void 0 }));
    const slots = slotCounts(profile, getClientData());
    const emptyAbilitySlots = [];
    for (let i = 1; i <= slots.abilities; i++) if (!profile.abilities[i]) emptyAbilitySlots.push(i);
    const raw = {
      zone,
      hours: settings2.hours,
      seedsPerRound: settings2.seeds,
      scope: all ? "all" : "abilities",
      emptyAbilitySlots,
      starter: settings2.starter || null,
      baseProfile: profile,
      base,
      baseRuns,
      telemetry: summaryOfTelemetry(telemetry),
      candidates: simulated
    };
    await tuneNewAbilities(pool, raw, settings2, onRefineProgress);
    for (const c2 of raw.candidates) delete c2.telemetry;
    for (let round = 0; round < 2; round++) {
      if (!await refineUncertain(pool, raw, settings2, onRefineProgress)) break;
    }
    return raw;
  }
  function triggerCandidate(change, profile) {
    return { kind: "trigger", slot: "trigger:" + change.hrid, hrid: change.hrid, target: change.target, triggers: change.triggers, was: change.was, rule: change.rule, why: change.why, cost: 0, owned: true, replaces: null, profile };
  }
  function summaryOfTelemetry(t4) {
    const perHour = (n5) => t4.hours ? n5 / t4.hours : 0;
    const abilities = {};
    for (const [hrid, s2] of Object.entries(t4.abilities)) {
      abilities[hrid] = { castsPerHour: perHour(s2.casts), waitingPerHour: perHour(s2.blocked), healed: s2.heals ? s2.healed / s2.heals : null };
    }
    return { abilities, maxEnemies: t4.maxEnemies, deathsFoodWaiting: perHour(t4.deathsFoodWaiting) };
  }
  async function tuneNewAbilities(pool, raw, settings2, onProgress) {
    const rated = rateUpgrades(raw, settings2);
    const top = rated.abilities.filter((c2) => c2.kind === "ability" && c2.delta > 0).slice(0, TUNED_ABILITIES);
    const tries = [];
    for (const rated2 of top) {
      const c2 = raw.candidates.find((x) => x.id === rated2.id);
      if (!c2?.telemetry) continue;
      for (const { change, profile } of triggerCandidates(c2.profile, c2.telemetry, [c2.hrid])) {
        const { result, runs: runs2, telemetry, id: id2, screened, ...rest } = c2;
        tries.push({ ...rest, profile, triggers: change.triggers, was: change.was, rule: change.rule });
      }
    }
    if (!tries.length) return 0;
    const seeds = Array.from({ length: raw.seedsPerRound }, (_, i) => i);
    const runs = await simulateRuns(pool, tries.map((t4) => ({ profile: t4.profile, seeds })), raw.zone, raw.hours, onProgress);
    const scores = (c2) => c2.runs.map((r) => score(r, rated.goal));
    const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
    let id = Math.max(...raw.candidates.map((c2) => c2.id)) + 1;
    for (const plain of top.map((r) => raw.candidates.find((x) => x.id === r.id))) {
      const mine2 = tries.map((t4, i) => ({ ...t4, result: summarize3(runs[i], raw.zone.tier, t4.profile), runs: runs[i] })).filter((t4) => t4.hrid === plain.hrid && t4.slot === plain.slot);
      const better2 = mine2.filter((t4) => mean(scores(t4)) > mean(scores(plain)) && (confidenceGreater(scores(t4), scores(plain)) ?? 0) >= TUNED_CONFIDENCE).sort((a, b) => mean(scores(b)) - mean(scores(a)))[0];
      if (better2) raw.candidates[raw.candidates.indexOf(plain)] = { ...better2, id: id++ };
    }
    return tries.length;
  }
  var TUNED_CONFIDENCE = 0.8;
  function uncertainCandidates(raw, settings2) {
    const rated = rateUpgrades(raw, settings2);
    const maxRuns = raw.seedsPerRound * MAX_SEED_FACTOR;
    return [...rated.gear, ...rated.abilities, ...rated.house, ...rated.orders, ...rated.triggers, ...rated.drinks, ...rated.food].filter((c2) => c2.delta > 0 && c2.safe && c2.confidence < REFINE_BELOW && c2.runs.length < maxRuns).sort((a, b) => b.delta - a.delta).slice(0, MAX_REFINED);
  }
  async function refineUncertain(pool, raw, settings2, onProgress) {
    const rated = rateUpgrades(raw, settings2);
    const maxRuns = raw.seedsPerRound * MAX_SEED_FACTOR;
    const rows = uncertainCandidates(raw, settings2);
    const siblings = rated.triggerVariants.filter((v) => rows.some((r) => r.kind === "trigger" && r.hrid === v.hrid && r.id !== v.id) && v.delta > 0 && v.safe && v.confidence < REFINE_BELOW && v.runs.length < maxRuns);
    const targets = [...rows, ...siblings].map((c2) => raw.candidates.find((x) => x.id === c2.id));
    if (!targets.length) return 0;
    const items = targets.map((c2) => {
      const first = Math.max(...c2.runs.map((r) => r.seed)) + 1;
      return { profile: c2.profile, seeds: Array.from({ length: raw.seedsPerRound }, (_, i) => first + i) };
    });
    const runs = await simulateRuns(pool, items, raw.zone, raw.hours, onProgress);
    targets.forEach((c2, i) => {
      delete c2.screened;
      c2.runs = [...c2.runs, ...runs[i]];
      c2.result = summarize3(c2.runs, raw.zone.tier, c2.profile);
    });
    return targets.length;
  }
  function rateUpgrades(raw, settings2) {
    const { base } = raw;
    const goal = makeGoal(settings2, { xp: xpValue(base, settings2), gold: base.loot });
    const baseScore = score(base, goal);
    const baseScores = raw.baseRuns.map((r) => score(r, goal));
    const used = (c2) => c2.remove || !["food", "drinks"].includes(c2.kind) || (c2.result.consumables[c2.hrid] || 0) > 0.01;
    const evaluated = raw.candidates.filter(used).map((c2) => {
      const delta = score(c2.result, goal) - baseScore;
      const confidence = (c2.runs.length < 2 ? confidenceOneRun(score(c2.runs[0], goal), baseScores) : confidenceGreater(c2.runs.map((r) => score(r, goal)), baseScores)) ?? 0.5;
      return {
        ...c2,
        delta,
        deltaPct: delta,
        // scores are already fractions of the reference
        confidence,
        significant: confidence >= CONFIDENCE_LEVEL,
        xpDelta: xpValue(c2.result, settings2) - xpValue(base, settings2),
        profitDelta: c2.result.profit - base.profit,
        // A change that makes you die noticeably more often is never recommended, whatever the
        // gain – unless you accept rare deaths and it stays within that limit.
        safe: c2.result.deaths <= Math.max(base.deaths * 1.1 + 0.3, deathLimit(settings2)),
        costPerHourDelta: c2.result.cost - base.cost,
        deathsDelta: c2.result.deaths - base.deaths
      };
    });
    const best = bestPerItem(evaluated);
    const byDelta = (a, b) => b.delta - a.delta;
    const table = getClientData()?.levelExperienceTable;
    for (const c2 of best) {
      if (c2.kind !== "skillLevel") continue;
      const rate2 = base.xp?.[c2.hrid] || 0;
      const xpNow = Array.isArray(table) ? experienceOf(table, raw.baseProfile.allExperience?.["/skills/" + c2.hrid], c2.fromLevel) : null;
      const need = Array.isArray(table) && table[c2.level] !== void 0 ? Math.max(0, table[c2.level] - xpNow) : null;
      c2.xpNeeded = need;
      c2.hoursToReach = need === null || !(rate2 > 0) ? null : need / rate2;
    }
    return {
      ...raw,
      goal,
      baseScore,
      gear: best.filter((c2) => c2.kind === "gear").sort(byDelta),
      abilities: best.filter((c2) => c2.kind === "ability" || c2.kind === "abilityLevel").sort(byDelta),
      orders: best.filter((c2) => c2.kind === "abilityOrder").sort(byDelta),
      triggers: best.filter((c2) => c2.kind === "trigger").sort(byDelta),
      triggerVariants: evaluated.filter((c2) => c2.kind === "trigger"),
      house: best.filter((c2) => c2.kind === "house").sort(byDelta),
      levels: best.filter((c2) => c2.kind === "skillLevel").sort((a, b) => a.hrid.localeCompare(b.hrid) || a.level - b.level),
      drinks: best.filter((c2) => c2.kind === "drinks").sort(byDelta),
      food: best.filter((c2) => c2.kind === "food").sort(byDelta)
    };
  }
  function stepConfidence(analysis, from, to) {
    if (!from) return to.confidence;
    const scores = (c2) => c2.runs.map((r) => score(r, analysis.goal));
    return confidenceGreater(scores(to), scores(from)) ?? 0.5;
  }
  function hullSteps(group, options, minGain, minEfficiency, confident) {
    const points = [{ cost: 0, delta: 0, candidate: null }, ...options.map((c2) => ({ cost: c2.cost, delta: c2.delta, candidate: c2 }))].sort(
      (a, b) => a.cost - b.cost || b.delta - a.delta
    );
    const rising = [];
    for (const p2 of points) {
      const last = rising[rising.length - 1];
      if (last && (p2.cost === last.cost || p2.delta <= last.delta)) continue;
      rising.push(p2);
    }
    const slope = (a, b) => (b.delta - a.delta) / (b.cost - a.cost);
    const hull = [];
    for (const p2 of rising) {
      while (hull.length >= 2 && slope(hull[hull.length - 2], hull[hull.length - 1]) <= slope(hull[hull.length - 1], p2)) hull.pop();
      hull.push(p2);
    }
    const steps = [];
    if (hull[0].candidate) steps.push({ group, to: hull[0].candidate, cost: 0, gain: hull[0].delta, efficiency: Infinity });
    let from = hull[0];
    let firstPaidEfficiency = null;
    for (let i = 1; i < hull.length; i++) {
      const to = hull[i];
      const gain = to.delta - from.delta;
      if (gain < (firstPaidEfficiency === null ? minGain : 2 * minGain) || !confident(from.candidate, to.candidate)) continue;
      const efficiency = gain / (to.cost - from.cost);
      if (efficiency < minEfficiency) break;
      if (firstPaidEfficiency === null) firstPaidEfficiency = efficiency;
      else if (efficiency < firstPaidEfficiency / 4) break;
      steps.push({ group, to: to.candidate, cost: to.cost - from.cost, gain, efficiency });
      from = to;
    }
    return steps;
  }
  function pickConsumable(list, gold) {
    const ok = list.filter((c2) => c2.significant && c2.safe && c2.delta > 0);
    if (!ok.length) return { value: null, max: null };
    const max = ok.reduce((a, b) => b.delta > a.delta + 1e-9 || Math.abs(b.delta - a.delta) <= 1e-9 && b.remove ? b : a);
    const preferStopping = (a, b) => (b.remove ? 1 : 0) - (a.remove ? 1 : 0);
    const value = gold > 0 ? max : ok.filter((c2) => c2.delta >= 0.5 * max.delta).sort((a, b) => a.costPerHourDelta - b.costPerHourDelta || preferStopping(a, b))[0];
    const stop = ok.find((c2) => c2.remove && c2.slot === value.slot && c2 !== value && c2.delta >= value.delta - STOP_TOLERANCE);
    const chosen = stop || value;
    return { value: chosen, max: max === chosen ? null : max };
  }
  var STOP_TOLERANCE = 5e-3;
  function buildPlan(analysis, budget, spending = "balanced") {
    budget -= analysis.starter?.cost || 0;
    const minGain = 0.01;
    const minEfficiency = (SPENDING[spending] || SPENDING.balanced).minPctPerMillion / 100 / 1e6;
    const usable = (c2) => c2.significant && c2.safe && c2.delta > 0;
    const groups = /* @__PURE__ */ new Map();
    for (const c2 of analysis.gear.filter(usable)) {
      const key2 = c2.slot === "main_hand" || c2.slot === "two_hand" ? "weapon" : c2.slot;
      if (!groups.has(key2)) groups.set(key2, []);
      groups.get(key2).push(c2);
    }
    for (const c2 of analysis.abilities.filter(usable)) {
      const key2 = c2.kind === "abilityLevel" || c2.replaces ? c2.slot : "new-ability:" + c2.hrid;
      if (!groups.has(key2)) groups.set(key2, []);
      groups.get(key2).push(c2);
    }
    for (const c2 of (analysis.house || []).filter(usable)) groups.set(c2.slot, [...groups.get(c2.slot) || [], c2]);
    const confident = (from, to) => stepConfidence(analysis, from, to) >= CONFIDENCE_LEVEL;
    const steps = [...groups.entries()].flatMap(([key2, options]) => hullSteps(key2, options, minGain, minEfficiency, confident));
    steps.sort((a, b) => b.efficiency - a.efficiency || b.gain - a.gain);
    const chosen = /* @__PURE__ */ new Map();
    const blocked = /* @__PURE__ */ new Set();
    const freeAbilitySlots = [...analysis.emptyAbilitySlots];
    const usedAbilities = /* @__PURE__ */ new Set();
    let spent = 0;
    for (const step of steps) {
      if (blocked.has(step.group)) continue;
      const isNewAbility = step.group.startsWith("new-ability:");
      if (spent + step.cost > budget || isNewAbility && !freeAbilitySlots.length || usedAbilities.has(step.to.hrid)) {
        blocked.add(step.group);
        continue;
      }
      spent += step.cost;
      if (isNewAbility) {
        chosen.set(step.group, { ...step.to, slot: "ability" + freeAbilitySlots.shift() });
      } else {
        chosen.set(step.group, step.to);
      }
      if (step.to.kind === "ability") usedAbilities.add(step.to.hrid);
    }
    let picks = [...chosen.values()];
    if (picks.some((p2) => p2.slot === "two_hand")) picks = picks.filter((p2) => p2.slot !== "off_hand");
    const isWeapon = (p2) => p2.slot === "main_hand" || p2.slot === "two_hand";
    const starter = analysis.starter && !picks.some(isWeapon) ? analysis.starter : null;
    if (analysis.starter) picks = picks.map((p2) => isWeapon(p2) ? { ...p2, replaces: analysis.starter.replaces } : p2);
    spent = picks.reduce((sum, p2) => sum + p2.cost, 0) + (starter?.cost || 0);
    const drink = pickConsumable(analysis.drinks, analysis.goal.gold);
    const food = pickConsumable(analysis.food, analysis.goal.gold);
    const data = getClientData();
    if (food.value && !food.value.remove && picks.some((p2) => p2.extraFood && sameKind(p2.extraFood, food.value.hrid, data))) food.value = null;
    const order = (analysis.orders || []).filter((c2) => usable(c2) && c2.delta >= STOP_TOLERANCE).sort((a, b) => b.delta - a.delta)[0] || null;
    const gone = /* @__PURE__ */ new Set([...picks.filter((p2) => p2.kind === "ability" && p2.replaces).map((p2) => p2.replaces), ...[food.value, drink.value].filter((p2) => p2?.remove || p2?.replaces).map((p2) => p2.replaces || p2.hrid)]);
    const triggers = [];
    for (const c2 of analysis.triggers || []) {
      if (!usable(c2) || c2.delta < STOP_TOLERANCE || gone.has(c2.hrid) || triggers.some((t4) => t4.hrid === c2.hrid)) continue;
      triggers.push(c2);
    }
    return { picks, starter, spent, drink: drink.value, drinkMax: drink.max, food: food.value, foodMax: food.max, order, triggers };
  }
  function reorderAbilities(profile, order) {
    const slots = [];
    profile.abilities.forEach((entry, index) => {
      if (index > 0 && entry && order.includes(entry.hrid)) slots.push(index);
    });
    const entries = slots.map((i) => profile.abilities[i]).sort((a, b) => order.indexOf(a.hrid) - order.indexOf(b.hrid));
    slots.forEach((slot, k) => profile.abilities[slot] = entries[k]);
  }
  function putConsumable(list, slot, hrid) {
    const index = Number(slot.replace(/\D+/g, ""));
    while (list.length <= index) list.push(null);
    list[index] = hrid;
  }
  function applyPlan(profile, plan) {
    const result = cloneProfile(profile);
    for (const pick2 of plan.picks) {
      if (pick2.kind === "gear") {
        equip(result, pick2.slot, { hrid: pick2.hrid, enhancementLevel: pick2.enhancementLevel });
        if (pick2.extraFood) putConsumable(result.food, "food" + pick2.extraFoodSlot, pick2.extraFood);
      } else if (pick2.kind === "ability" || pick2.kind === "abilityLevel") {
        result.abilities[Number(pick2.slot.replace("ability", ""))] = { hrid: pick2.hrid, level: pick2.level };
        if (pick2.triggers) result.abilityTriggers = { ...result.abilityTriggers || {}, [pick2.hrid]: pick2.triggers };
      } else if (pick2.kind === "house") {
        result.houseRooms = { ...result.houseRooms, [pick2.hrid]: pick2.level };
      }
    }
    if (plan.order) reorderAbilities(result, plan.order.order);
    for (const t4 of plan.triggers || []) {
      const map = t4.target === "ability" ? "abilityTriggers" : "consumableTriggers";
      result[map] = { ...result[map] || {}, [t4.hrid]: t4.triggers };
    }
    for (const pick2 of [plan.drink, plan.food]) {
      if (pick2) putConsumable(pick2.kind === "food" ? result.food : result.drinks, pick2.slot, pick2.remove ? null : pick2.hrid);
    }
    return result;
  }
  async function verifyPlan(pool, profile, plan, zone, settings2, onProgress) {
    const variants = [{ kind: "base", profile }, { kind: "plan", profile: applyPlan(profile, plan) }];
    const [base, planned] = await simulateVariants(pool, variants, zone, settings2, onProgress);
    return { base: base.result, planned: planned.result };
  }
  var LOADOUT_ROUNDS = 3;
  async function analyzeLoadout(pool, profile, zone, settings2, onProgress) {
    const run = { ...settings2, budget: 0 };
    let current = profile;
    let before = null;
    let last = null;
    let rounds = 0;
    for (let round = 1; round <= LOADOUT_ROUNDS; round++) {
      const raw = await loadoutRound(pool, current, zone, run, (done2, total) => onProgress?.(done2, total, round));
      before || (before = raw.base);
      last = raw.base;
      const plan = buildPlan(rateUpgrades(raw, run), 0, run.spending);
      if (!plan.picks.length && !plan.order && !plan.drink && !plan.food) break;
      current = applyPlan(current, { picks: plan.picks, order: plan.order, drink: plan.drink, food: plan.food });
      last = null;
      rounds = round;
    }
    if (!last) [{ result: last }] = await simulateVariants(pool, [{ profile: current }], zone, run, (done2, total) => onProgress?.(done2, total, rounds + 1));
    return { zone, start: profile, final: current, rounds, before, after: last };
  }
  async function loadoutRound(pool, profile, zone, settings2, onProgress) {
    const data = getClientData();
    const slots = slotCounts(profile, data);
    const seeds = (n5) => Array.from({ length: n5 }, (_, i) => i);
    const drinks = profile.drinks.slice(0, slots.drinks);
    const food = profile.food.slice(0, slots.food);
    const without = [];
    for (let i = 1; i <= slots.abilities; i++) {
      if (!profile.abilities[i]) continue;
      const variant = cloneProfile(profile);
      variant.abilities[i] = null;
      without.push({ kind: "ability", index: i, profile: variant });
    }
    const removals = [...consumableCandidates(profile, "drinks", { onlyUseful: true }), ...consumableCandidates(profile, "food", { onlyUseful: true })].filter((c2) => c2.remove);
    const baseItem2 = { profile, seeds: seeds(settings2.seeds * BASE_SEED_FACTOR) };
    const first = [baseItem2, ...[...without, ...removals].map((c2) => ({ profile: c2.profile, seeds: seeds(settings2.seeds) }))];
    const firstRuns = first.reduce((sum, item) => sum + item.seeds.length, 0);
    let planned = firstRuns * 5;
    const [baseRuns, ...stepOne] = await simulateRuns(pool, first, zone, settings2.hours, (done2) => onProgress?.(done2, planned));
    const base = summarize3(baseRuns, zone.tier, profile);
    const goal = makeGoal(settings2, { xp: xpValue(base, settings2), gold: base.loot });
    const scored = [...without, ...removals].map((c2, i) => ({ ...c2, score: score(summarize3(stepOne[i], zone.tier, c2.profile), goal), runs: stepOne[i] }));
    const weakest = (pick2) => scored.filter(pick2).sort((a, b) => b.score - a.score)[0] || null;
    const ability = weakest((c2) => c2.kind === "ability");
    const drink = weakest((c2) => c2.kind === "drinks");
    const meal = weakest((c2) => c2.kind === "food");
    const index = (c2) => c2 ? Number(c2.slot.replace(/\D+/g, "")) : null;
    const candidates = [
      ...abilityCandidates(profile, 0, ability?.index ?? null),
      ...abilityOrderCandidates(profile),
      ...consumableCandidates(profile, "drinks", { onlyUseful: true, replace: drinks.every(Boolean) ? index(drink) : null }).filter((c2) => !c2.remove),
      ...consumableCandidates(profile, "food", { onlyUseful: true, replace: food.every(Boolean) ? index(meal) : null }).filter((c2) => !c2.remove)
    ];
    planned = firstRuns + candidates.length * settings2.seeds;
    const items = candidates.map((c2) => ({ profile: c2.profile, seeds: seeds(settings2.seeds) }));
    const runs = await simulateScreened(pool, candidates, items, baseRuns, base, zone, settings2, (done2, total) => {
      planned = firstRuns + total;
      onProgress?.(firstRuns + done2, planned);
    });
    const simulated = [
      ...candidates.map((c2, i) => ({ ...c2, result: summarize3(runs[i], zone.tier, c2.profile), runs: runs[i] })),
      ...scored.filter((c2) => c2.remove).map(({ score: _, ...c2 }) => ({ ...c2, result: summarize3(c2.runs, zone.tier, c2.profile) }))
    ];
    simulated.forEach((c2, id) => c2.id = id);
    const emptyAbilitySlots = [];
    for (let i = 1; i <= slots.abilities; i++) if (!profile.abilities[i]) emptyAbilitySlots.push(i);
    const raw = { zone, hours: settings2.hours, seedsPerRound: settings2.seeds, scope: "loadout", emptyAbilitySlots, starter: null, baseProfile: profile, base, baseRuns, telemetry: null, candidates: simulated };
    await refineUncertain(pool, raw, settings2, (done2, total) => onProgress?.(planned + done2, planned + total));
    return raw;
  }

  // src/pool.js
  var SimPool = class {
    constructor(workerSource, tables, size) {
      this.url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
      this.tables = tables;
      this.size = size;
      this.workers = [];
      this.queue = [];
      this.pending = /* @__PURE__ */ new Map();
      this.nextId = 1;
      this.cancelled = false;
    }
    async start() {
      const ready2 = [];
      for (let i = 0; i < this.size; i++) {
        const worker = new Worker(this.url);
        const entry = { worker, busy: true };
        ready2.push(
          new Promise((resolve2, reject) => {
            worker.onmessage = (event) => {
              if (event.data.type === "ready") {
                worker.onmessage = (e2) => this.onResult(entry, e2.data);
                entry.busy = false;
                resolve2();
              }
            };
            worker.onerror = (event) => reject(new Error(event.message || "Simulation worker error"));
          })
        );
        worker.postMessage({ type: "init", data: this.tables });
        this.workers.push(entry);
      }
      await Promise.all(ready2);
    }
    run(job) {
      return new Promise((resolve2, reject) => {
        this.queue.push({ id: this.nextId++, job, resolve: resolve2, reject });
        this.pump();
      });
    }
    // Runs all jobs; onProgress(done, total) is called as they finish.
    async runAll(jobs, onProgress) {
      this.cancelled = false;
      let done2 = 0;
      return Promise.all(
        jobs.map(
          (job) => this.run(job).then((result) => {
            done2++;
            onProgress?.(done2, jobs.length);
            return result;
          })
        )
      );
    }
    cancel() {
      this.cancelled = true;
      const error = new Error("Cancelled");
      for (const task of this.queue) task.reject(error);
      this.queue = [];
    }
    pump() {
      for (const entry of this.workers) {
        if (entry.busy || this.queue.length === 0) continue;
        const task = this.queue.shift();
        entry.busy = true;
        this.pending.set(task.id, task);
        entry.worker.postMessage({ type: "sim", id: task.id, job: task.job });
      }
    }
    onResult(entry, message) {
      entry.busy = false;
      const task = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (task) {
        if (message.type === "result") task.resolve(message.result);
        else task.reject(new Error(message.error));
      }
      this.pump();
    }
    terminate() {
      for (const entry of this.workers) entry.worker.terminate();
      this.workers = [];
      URL.revokeObjectURL(this.url);
    }
  };

  // src/style.js
  var NARROW = "(max-width: 700px), (max-height: 500px)";
  var CSS = `
.mwia-launcher {
  position: fixed; right: 44px; bottom: 74px; z-index: 999;
  width: 36px; height: 36px; padding: 0; border-radius: 50%; border: 1px solid #5b6bb0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(38,44,74,.85); color: #e8ebff; font: 18px/1 sans-serif; cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,.4); touch-action: none; user-select: none; -webkit-user-select: none;
}
.mwia-launcher:hover { background: #333b63; }
.mwia-launcher.mwia-has-alert::after {
  content: ""; position: absolute; top: -2px; right: -2px; width: 11px; height: 11px;
  border-radius: 50%; background: #e5484d; border: 2px solid #171b2e;
}
.mwia-launcher.mwia-has-news::before {
  content: ""; position: absolute; top: -2px; left: -2px; width: 11px; height: 11px;
  border-radius: 50%; background: #3e8ef7; border: 2px solid #171b2e;
}
.mwia-alert-row td { background: rgba(229,72,77,.08); }
.mwia-horizon-best { border: 1px solid #3e8ef7; border-radius: 6px; padding: 4px 10px; margin: 6px 0 10px; background: rgba(62,142,247,.07); }
.mwia-horizon-plan { border-top: 1px solid rgba(255,255,255,.08); padding: 6px 0; }
.mwia-horizon-plan > summary { cursor: pointer; }
.mwia-horizon-spark { width: 160px; height: 24px; vertical-align: middle; color: #3e8ef7; }
.mwia-version {
  align-self: center; margin-left: 5px; font: 400 9px/1 sans-serif; color: #aab3d9; opacity: .6;
  text-decoration: none; white-space: nowrap; cursor: default;
}
.mwia-version-old {
  color: #ff5c5c; opacity: 1; font-weight: 700; cursor: pointer; text-shadow: 0 0 5px rgba(255,70,70,.8);
  animation: mwia-version-glow 2s ease-in-out infinite alternate;
}
@keyframes mwia-version-glow { from { text-shadow: 0 0 2px rgba(255,70,70,.4); } to { text-shadow: 0 0 7px rgba(255,70,70,.95); } }
.mwia-panel {
  position: fixed; top: 48px; right: 44px; z-index: 1000;
  width: min(880px, calc(100vw - 58px)); max-height: calc(100vh - 64px);
  display: flex; flex-direction: column;
  background: #171b2e; color: #dfe3f5; border: 1px solid #3c4677; border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,.55); font: 13px/1.45 sans-serif;
}
.mwia-hidden { display: none; }
.mwia-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #2c3459; }
.mwia-tabs { display: flex; gap: 4px; padding: 8px 10px 0; border-bottom: 1px solid #2c3459; flex-wrap: wrap; }
.mwia-tab { background: none; border: none; color: #aab2d8; padding: 6px 12px; cursor: pointer; border-bottom: 2px solid transparent; font: inherit; }
.mwia-tab.mwia-active { color: #fff; border-bottom-color: #7c8cff; }
.mwia-body { padding: 12px 14px 16px; overflow: auto; }
.mwia-body h3 { margin: 14px 0 6px; font-size: 14px; color: #c9d0ff; }
.mwia-body p { margin: 6px 0; }
.mwia-body ul, .mwia-body ol { margin: 4px 0 8px; padding-left: 20px; }
.mwia-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.mwia-table { border-collapse: collapse; width: 100%; }
.mwia-table td, .mwia-table th { padding: 3px 6px; border-bottom: 1px solid #262d4d; text-align: left; vertical-align: top; }
.mwia-table th { color: #9aa3cf; font-weight: 600; }
.mwia-wide { font-size: 12px; margin-bottom: 6px; }
.mwia-num { text-align: right !important; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mwia-sum td { font-weight: 700; }
.mwia-best td { background: #1f3326; }
.mwia-faded td { opacity: .55; }
.mwia-settings { display: flex; flex-wrap: wrap; gap: 8px 14px; margin: 8px 0; }
.mwia-settings label { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #9aa3cf; }
.mwia-settings select, .mwia-settings input { background: #0f1222; color: #e8ebff; border: 1px solid #3c4677; border-radius: 5px; padding: 3px 6px; font: inherit; max-width: 260px; }
.mwia-focus-row { display: flex; align-items: center; gap: 6px; color: #aab2d8; }
.mwia-settings .mwia-focus-row input { width: 130px; padding: 0; border: none; background: none; accent-color: #f2c25b; }
.mwia-focus-text { color: #e8ebff; }
.mwia-settings input.mwia-invalid { border-color: #ff7b7b; }
.mwia-cart-btn { background: #1e3a33; color: #8fe0c0; border: 1px solid #2f6b5a; border-radius: 4px; padding: 0 6px; font: 11px/1.6 sans-serif; cursor: pointer; white-space: nowrap; }
.mwia-cart-btn:hover { background: #26493f; }
.mwia-notice { padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #3c4677; background: #1d2440; }
.mwia-notice-ok { border-color: #2f6b5a; background: #17302a; }
.mwia-notice-warn { border-color: #7a6a2a; background: #2e2a17; }
.mwia-notice-bad { border-color: #a03a4c; background: #4a1f28; }
.mwia-notice-copy { display: block; margin-top: 4px; }
.mwia-notice-diag { margin-top: 6px; font: 11px/1.35 monospace; opacity: .8; overflow-wrap: anywhere; user-select: text; -webkit-user-select: text; }
.mwia-btn { background: #4c5bd4; color: #fff; border: none; border-radius: 6px; padding: 7px 14px; font: 600 13px sans-serif; cursor: pointer; margin: 4px 0 8px; }
.mwia-btn:disabled { opacity: .5; cursor: default; }
.mwia-link { background: none; border: none; color: #9aa3cf; cursor: pointer; font: inherit; padding: 2px 6px; }
.mwia-link:hover { color: #fff; }
.mwia-dim { color: #8189b0; }
.mwia-ok { color: #6fdc8c; }
.mwia-warn { color: #f2c25b; }
.mwia-bad { color: #ff7b7b; }
.mwia-enh { color: #7fd0ff; }
.mwia-tier { color: #f2a65b; font-weight: 700; }
.mwia-error { background: #4a1f28; border: 1px solid #a03a4c; padding: 8px 10px; border-radius: 6px; margin-bottom: 8px; }
.mwia-laby-guide { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; margin: 8px 0; }
.mwia-laby-tile { background: #1a2036; border-left: 4px solid #3c4677; border-radius: 4px; padding: 6px 8px; font-size: 12px; }
.mwia-laby-tile-name { color: #e8ebff; font-weight: 600; }
.mwia-laby-tile-action { font-size: 13px; margin: 2px 0; }
.mwia-laby-ok { border-left-color: #6fdc8c; } .mwia-laby-ok .mwia-laby-tile-action { color: #6fdc8c; }
.mwia-laby-warn { border-left-color: #f2c25b; } .mwia-laby-warn .mwia-laby-tile-action { color: #f2c25b; }
.mwia-laby-bad { border-left-color: #ff7b7b; } .mwia-laby-bad .mwia-laby-tile-action { color: #ff7b7b; }
.mwia-reco { background: #1d2b45; border-left: 3px solid #7c8cff; padding: 8px 10px; border-radius: 4px; margin: 8px 0; }
.mwia-progress { margin: 6px 0 10px; }
.mwia-progress-label { display: flex; justify-content: space-between; font-size: 12px; color: #aab2d8; }
.mwia-bar { height: 6px; background: #262d4d; border-radius: 3px; overflow: hidden; }
.mwia-bar div { height: 100%; background: #7c8cff; transition: width .2s; }
.mwia-tips li { margin: 3px 0; }
.mwia-tip-bad::marker { content: "\u2716 "; color: #ff7b7b; }
.mwia-tip-warn::marker { content: "\u26A0 "; color: #f2c25b; }
.mwia-tip-info::marker { content: "\u2139 "; color: #7fd0ff; }
.mwia-tip-ok::marker { content: "\u2714 "; color: #6fdc8c; }
.mwia-plan li { margin: 3px 0; }
.mwia-guide p, .mwia-guide li { max-width: 72ch; }
.mwia-train {
  position: fixed; right: 44px; bottom: 112px; z-index: 1500;
  width: min(330px, calc(100vw - 58px)); max-height: 55vh; overflow: auto;
  padding: 8px 10px; background: #171b2e; color: #dfe3f5; border: 1px solid #3c4677; border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,.55); font: 12px/1.45 sans-serif;
}
.mwia-train p { margin: 5px 0; }
.mwia-loop { bottom: auto; top: 70px; }
.mwia-launcher.mwia-loop-icon { bottom: 122px; }
.mwia-loop-count {
  position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%);
  padding: 0 4px; border-radius: 6px; background: #171b2e; border: 1px solid #5b6bb0;
  font: 600 9px/1.4 sans-serif; color: #e8ebff; white-space: nowrap; pointer-events: none;
}
.mwia-train-head { display: flex; align-items: center; gap: 4px; }
.mwia-train-head b { flex: 1; }
.mwia-train-now { margin: 4px 0; padding: 4px 8px; border-radius: 6px; background: #1d2b45; border-left: 3px solid #f2c25b; font-weight: 600; }
.mwia-train-buttons { display: flex; gap: 6px; margin: 4px 0 6px; }
.mwia-train-buttons button:disabled { opacity: .5; cursor: default; }
.mwia-train-stops { margin: 4px 0; padding-left: 22px; }
.mwia-train-stops li { margin: 1px 0; }
.mwia-train-stops .mwia-num { color: #c9d0ff; }
.mwia-train-done { opacity: .5; text-decoration: line-through; }
.mwia-train-current { color: #ffe27a; font-weight: 600; }
.mwia-train-start {
  margin-left: 8px; padding: 5px 10px; border-radius: 6px; border: 1px solid #f2c25b;
  background: #43351f; color: #ffe2a0; font: 600 12px sans-serif; cursor: pointer; white-space: nowrap;
}
/* MWITools lays rows out as grids or flex rows; the cost line takes a whole row of its own.
   The planning-tab prefix outweighs MWITools' own rules for text in a row. */
.planning-step .mwia-plan-cost, .planning-stage .mwia-plan-costs {
  grid-column: 1 / -1; flex-basis: 100%; width: 100%; box-sizing: border-box; text-align: left;
  font: 400 12px/1.4 sans-serif; color: #aab3dc;
}
.planning-step .mwia-plan-cost { margin-top: 4px; }
.planning-stage .mwia-plan-costs { margin: 6px 0; padding: 6px 10px; border: 1px solid #3c4677; border-radius: 6px; background: #1d2440; color: #dde2ff; }
.planning-step .mwia-plan-cost-best, .planning-stage .mwia-plan-cost-best { color: #7ee2b0; font-weight: 600; }
.mwia-skill-list { display: flex; flex-direction: column; }
.mwia-skill-row { border-bottom: 1px solid #262d4d; }
.mwia-skill-row.mwia-best { background: #1f3326; }
.mwia-skill-row.mwia-faded > summary { opacity: .6; }
.mwia-skill-row > summary { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 6px 4px; cursor: pointer; list-style: none; }
.mwia-skill-row > summary::-webkit-details-marker { display: none; }
.mwia-skill-row > summary::before { content: "\u25B8"; color: #5b6bb0; flex: none; }
.mwia-skill-row[open] > summary::before { content: "\u25BE"; }
.mwia-skill-name { flex: 1; min-width: 0; }
.mwia-skill-name small, .mwia-skill-hint { display: block; color: #8189b0; font-size: 11px; }
.mwia-skill-hint { color: #7ee2b0; }
.mwia-skill-nums { display: flex; flex-direction: column; align-items: flex-end; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mwia-skill-nums .mwia-dim { font-size: 11px; }
.mwia-skill-full { font-size: 11px; color: #8189b0; }
.mwia-export { margin: 4px 0; }
.mwia-export-btn { font: inherit; font-size: 12px; padding: 3px 8px; border-radius: 6px; border: 1px solid #4b5585; background: #1d2240; color: #dfe3ff; cursor: pointer; }
.mwia-skill-full.mwia-warn { color: #f2c25b; }
.mwia-skill-detail { padding: 2px 8px 8px 20px; font-size: 12px; color: #c3c9e8; overflow-wrap: anywhere; }
.mwia-skill-detail p { margin: 4px 0; }
.mwia-skill-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 6px; }
.mwia-skill-buttons .mwia-btn { margin: 0; }
.mwia-btn-quiet { background: #2a3150; border: 1px solid #3c4677; }
.mwia-upgrade { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 4px; border-bottom: 1px solid #262d4d; }
.mwia-upgrade small { display: block; color: #8189b0; font-size: 11px; }
.mwia-skill-sec { border-top: 1px solid #232a48; }
.mwia-skill-sec > summary { padding: 5px 0; cursor: pointer; list-style: none; }
.mwia-skill-sec > summary::-webkit-details-marker { display: none; }
.mwia-skill-sec > summary::before { content: "\u25B8 "; color: #5b6bb0; }
.mwia-skill-sec[open] > summary::before { content: "\u25BE "; }
.mwia-skill-sec > p { margin: 2px 0 6px 14px; }
.mwia-history { box-sizing: border-box; width: 100%; height: auto; flex: 0 0 auto; align-self: stretch; grid-column: 1 / -1; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; margin: 6px 0; padding: 6px 10px; border: 1px solid #3c4677; border-radius: 6px; background: #1d2440; color: #dde2ff; font: 400 12px/1.4 sans-serif; text-align: left; }
.mwia-history-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 8px; }
.mwia-history-head span, .mwia-history-note, .mwia-history-scale { color: #8189b0; font-size: 11px; }
.mwia-history-high { color: #ff9b7b; }
.mwia-history-low { color: #7ee2b0; }
.mwia-history-chart { display: block; width: 100%; height: 64px; }
.mwia-history-volume { display: block; width: 100%; height: 18px; margin-top: 2px; }
.mwia-history-volume rect { fill: #6c78c9; opacity: 0.7; }
.mwia-history-vol-scale { justify-content: flex-start; }
i.mwia-history-vol { background: #6c78c9; height: 6px !important; }
.mwia-history-medians { margin: 2px 0 4px; font-variant-numeric: tabular-nums; color: #b7bee3; font-size: 11px; }
.mwia-history-chart polyline { fill: none; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
polyline.mwia-history-ask { stroke: #f2a65b; }
polyline.mwia-history-bid { stroke: #7ee2b0; }
.mwia-history-scale { display: flex; justify-content: space-between; }
.mwia-history-plot { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0 6px; }
.mwia-history-y { flex-direction: column; text-align: right; }
.mwia-history-ranges { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.mwia-history-ranges button { background: #2a3150; color: #dde2ff; border: 1px solid #3c4677; border-radius: 4px; padding: 2px 8px; font: 11px sans-serif; cursor: pointer; }
.mwia-history-ranges button.mwia-active { background: #4c5bd4; }
.mwia-history-export { flex-wrap: wrap; margin-top: 6px; }
.mwia-history-export span { order: 3; margin-left: 0 !important; flex-basis: 100%; }
.mwia-history-ranges span { margin-left: auto; color: #8189b0; font-size: 11px; }
.mwia-history-ranges i { display: inline-block; width: 10px; height: 2px; margin: 0 3px 3px 6px; vertical-align: middle; }
i.mwia-history-ask { background: #f2a65b; }
i.mwia-history-bid { background: #7ee2b0; }
.mwia-history-sum { margin: 2px 0; font-variant-numeric: tabular-nums; }
.mwia-history-sum span { white-space: nowrap; }
.mwia-history-more summary { cursor: pointer; color: #9aa3cf; font-size: 11px; margin-top: 2px; }
.mwia-history-more[open] summary { margin-bottom: 4px; }
.mwia-history-head .mwia-history-prelim { color: #ffd479; font-weight: 600; }
.mwia-guide-box, .mwia-loadout-box, .mwia-tool-box, .mwia-plan-box { box-sizing: border-box; width: 100%; height: auto; flex: 0 0 auto; align-self: stretch; grid-column: 1 / -1; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; margin: 6px 0; padding: 6px 10px; border: 1px solid #3c4677; border-radius: 6px; background: #1d2440; color: #dde2ff; font: 400 12px/1.4 sans-serif; text-align: left; }
.mwia-guide-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 8px; }
.mwia-guide-head span, .mwia-guide-list li span, .mwia-guide-status { color: #8189b0; font-size: 11px; }
.mwia-guide-sub { margin-top: 4px; color: #9aa3cf; font-size: 11px; }
.mwia-guide-list { list-style: none; margin: 2px 0; padding: 0; }
.mwia-guide-list li { margin: 1px 0; }
.mwia-guide-keep { color: #7ee2b0; }
.mwia-guide-add { color: #ffd479; font-weight: 600; }
.mwia-guide-remove { color: #ff9b7b; }
.mwia-guide-list li span .mwia-guide-low, .mwia-guide-low { color: #ffd479; font-weight: 600; }
.mwia-guide-note { margin: 2px 0; }
.mwia-guide-cart { margin-top: 4px; background: #2a3150; color: #dde2ff; border: 1px solid #3c4677; border-radius: 4px; padding: 3px 10px; font: 12px sans-serif; cursor: pointer; }
.mwia-listprice { margin: 6px 0; padding: 6px 8px; border: 1px solid #3c4677; border-radius: 6px; background: #1d2440; color: #dde2ff; font: 400 12px/1.4 sans-serif; text-align: left; }
.mwia-listprice-buttons { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
.mwia-listprice-buttons button { display: flex; flex-direction: column; align-items: center; flex: 1 1 0; min-width: 44px; max-width: 80px; padding: 3px 2px; white-space: nowrap; background: #2a3150; color: #dde2ff; border: 1px solid #3c4677; border-radius: 4px; font: 600 12px sans-serif; cursor: pointer; }
.mwia-listprice-buttons button small { font-weight: 400; font-size: 11px; color: #9aa3cf; }
.mwia-listprice-buttons button.mwia-off { opacity: .5; cursor: help; }
.mwia-jobline { margin-top: 6px; padding: 4px 8px; border: 1px solid #3c4677; border-radius: 6px; background: #1d2440; color: #dde2ff; font: 400 13px/1.45 sans-serif; text-align: left; }
.mwia-jobline summary { cursor: pointer; }
.mwia-jobline p { margin: 4px 0; font-size: 12px; }
.mwia-jobline .mwia-ok { color: #6fdc8c; }
.mwia-jobline .mwia-bad { color: #ff7b7b; }
.mwia-jobline .mwia-dim { color: #9aa3cf; }
.mwia-listprice-limit { display: flex; flex-direction: column; align-items: center; width: 100%; margin-bottom: 4px; padding: 4px; background: #1e3a33; color: #8fe0c0; border: 1px solid #2f6b5a; border-radius: 4px; font: 600 12px sans-serif; cursor: pointer; }
.mwia-listprice-limit small { font-weight: 400; font-size: 11px; color: #9fcfbd; }
.mwia-listprice-limit.mwia-off { opacity: .5; cursor: help; }
.mwia-listprice-info { margin-top: 4px; color: #9aa3cf; font-size: 11px; text-align: center; }
.mwia-guide-hours { display: flex; flex-wrap: wrap; gap: 4px; margin: 2px 0 4px; }
.mwia-guide-hour { min-width: 32px; padding: 4px 6px; background: #2a3150; color: #dde2ff; border: 1px solid #3c4677; border-radius: 4px; font: 600 12px sans-serif; cursor: pointer; }
.mwia-guide-hour.mwia-guide-picked { background: #4a5bb8; border-color: #8a98e8; }
.mwia-guide-dim { color: #8189b0; font-size: 11px; }
.mwia-tool-box { margin: 10px 0; }
.mwia-plan-box { margin: 8px 0; }
.mwia-plan-table { margin: 4px 0 2px; font-variant-numeric: tabular-nums; }
.mwia-plan-grid { display: grid; grid-template-columns: 2.6em 3.6em 1fr 1fr 1fr; gap: 0 6px; align-items: baseline; padding: 3px 2px; }
.mwia-plan-grid span:nth-child(n+3) { text-align: right; white-space: nowrap; }
.mwia-plan-header { color: #8189b0; font-size: 11px; border-bottom: 1px solid #3c4677; }
.mwia-plan-row { border-bottom: 1px solid #2a3150; }
.mwia-plan-row > summary { cursor: pointer; list-style: none; }
.mwia-plan-row > summary::-webkit-details-marker { display: none; }
.mwia-plan-row[open] { background: #232b4d; padding-bottom: 4px; }
.mwia-plan-row[open] > :not(summary) { margin-left: 6px; margin-right: 6px; }
.mwia-plan-dear > summary { color: #8189b0; }
.mwia-plan-avg > summary span:nth-child(3) { font-style: italic; }
.mwia-plan-reach > summary { color: #7ee2b0; }
.mwia-plan-more > summary { cursor: pointer; color: #9aa3cf; font-size: 11px; padding: 3px 2px; }
.mwia-plan-buttons { display: flex; flex-wrap: wrap; gap: 4px; }
.mwia-plan-buttons .mwia-guide-cart { margin-top: 2px; }
.mwia-plan-box .mwia-ok { color: #7ee2b0; }
.mwia-plan-busy { color: #ffd479; }
.mwia-tool-list { list-style: none; margin: 4px 0; padding: 0; }
.mwia-tool-list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 0; border-top: 1px solid #2a3150; }
.mwia-tool-list li .mwia-guide-cart { margin-top: 0; flex: 0 0 auto; }
[data-mwia-tea="wrong"] { outline: 3px solid #ff4d4d !important; outline-offset: -3px; border-radius: 4px; animation: mwia-tea-wrong 1.2s ease-in-out infinite; }
[data-mwia-slot="wrong"] { outline: 3px solid #ff4d4d !important; outline-offset: -3px; border-radius: 4px; animation: mwia-tea-wrong 1.2s ease-in-out infinite; }
.mwia-loadout-box .mwia-guide-cart[disabled] { opacity: 0.6; cursor: default; }
[data-mwia-tea="right"] { outline: 3px solid #3ddc84 !important; outline-offset: -3px; border-radius: 4px; animation: mwia-tea-right 1.2s ease-in-out infinite; }
@keyframes mwia-tea-wrong { 0%, 100% { box-shadow: 0 0 4px 1px rgba(255, 77, 77, 0.5); } 50% { box-shadow: 0 0 12px 4px rgba(255, 77, 77, 0.95); } }
@keyframes mwia-tea-right { 0%, 100% { box-shadow: 0 0 4px 1px rgba(61, 220, 132, 0.5); } 50% { box-shadow: 0 0 12px 4px rgba(61, 220, 132, 0.95); } }
.mwia-trig-bar { margin: 0 0 6px; padding: 4px 6px; border: 1px solid #3c4677; border-radius: 6px; background: #1d2440; color: #dde2ff; font: 400 12px/1.4 sans-serif; }
.mwia-trig-line { margin-bottom: 3px; }
.mwia-trig-bar button { padding: 3px 8px; border: 0; border-radius: 4px; background: #4f5bd5; color: #fff; font: 600 12px/1.4 sans-serif; cursor: pointer; }
.mwia-laby-note { margin: 4px 0 6px; padding: 5px 8px; border: 1px solid #3c4677; border-radius: 6px; background: #1d2440; color: #dde2ff; font: 400 12px/1.4 sans-serif; text-align: left; }
[class*="LabyrinthPanel_roomCell"] { position: relative; }
.mwia-laby-cellmark { position: absolute; inset: 0; box-sizing: border-box; border: 3px solid currentColor; border-radius: 3px; pointer-events: none; }
.mwia-laby-cellmark span { position: absolute; top: 50%; right: 0; transform: translateY(-50%); padding: 0 1px; border-radius: 2px 0 0 2px; background: rgba(16, 20, 40, 0.8); font: 700 7px/1.1 sans-serif; }
.mwia-laby-cellmark.mwia-laby-ok { color: #7ee2b0; }
.mwia-laby-cellmark.mwia-laby-warn { color: #ffd479; }
.mwia-laby-cellmark.mwia-laby-bad { color: #ff8f8f; }
.mwia-laby-mark { margin-top: 3px; font: 400 11px/1.3 sans-serif; text-align: left; white-space: normal; }
.mwia-laby-mark.mwia-laby-ok { color: #7ee2b0; }
.mwia-laby-mark.mwia-laby-warn { color: #ffd479; }
.mwia-laby-mark.mwia-laby-bad { color: #ff8f8f; }
.mwia-laby-mark.mwia-laby-pick:not(.mwia-laby-bad) { font-weight: 700; color: #ffd479; }
.mwia-tea-note { margin: 6px 4px 2px; padding: 5px 8px; border: 1px solid #3c4677; border-radius: 6px; background: #1d2440; color: #dde2ff; font: 400 12px/1.4 sans-serif; text-align: left; }
.mwia-train-target { outline: 3px solid #ffd257 !important; outline-offset: 2px; border-radius: 4px; }
.mwia-narrow-only { display: none; }
.mwia-tip-pop {
  position: fixed; z-index: 2000; max-width: min(300px, calc(100vw - 16px)); padding: 6px 9px; border-radius: 6px;
  background: #0f1222; color: #e8ebff; border: 1px solid #5b6bb0; box-shadow: 0 4px 16px rgba(0,0,0,.6); font: 12px/1.4 sans-serif;
}

/* Touch screens: bigger targets, and 16px inputs so iOS doesn't zoom in on focus. */
@media (hover: none), (pointer: coarse) {
  .mwia-panel button, .mwia-train button, .mwia-train-start { touch-action: manipulation; }
  .mwia-launcher { width: 44px; height: 44px; font-size: 22px; }
  .mwia-tab { padding: 10px 12px; }
  .mwia-link { padding: 6px 10px; }
  .mwia-btn { padding: 10px 16px; }
  .mwia-cart-btn { font-size: 13px; padding: 4px 10px; min-height: 32px; }
  .mwia-settings select, .mwia-settings input[type="text"] { font-size: 16px; padding: 6px 8px; }
  .mwia-settings input[type="checkbox"] { width: 22px; height: 22px; }
  .mwia-panel th[title], .mwia-panel span[title], .mwia-panel label[title] { text-decoration: underline dotted #5b6bb0; }
}

@media ${NARROW} {
  .mwia-panel {
    top: 0; right: 0; bottom: 0; left: 0; width: auto; max-height: none; z-index: 1400;
    border: none; border-radius: 0; box-sizing: border-box;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .mwia-header .mwia-link { font-size: 20px; }
  .mwia-tabs { flex-wrap: nowrap; overflow-x: auto; }
  .mwia-tab { white-space: nowrap; }
  .mwia-body { flex: 1; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 10px 12px 24px; }
  .mwia-settings label { flex: 1 1 140px; }
  .mwia-settings select, .mwia-settings input[type="text"] { max-width: none; width: 100%; box-sizing: border-box; }

  /* Wide tables become one card per row. */
  .mwia-wide, .mwia-wide tbody { display: block; }
  .mwia-wide thead { display: none; }
  .mwia-wide tr { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 14px; padding: 8px 4px; border-bottom: 1px solid #2c3459; }
  .mwia-wide td { display: flex; justify-content: space-between; gap: 8px; padding: 0; border: none; text-align: left !important; }
  .mwia-wide td::before { content: attr(data-label); color: #8189b0; white-space: nowrap; }
  .mwia-wide td[data-label=""]::before, .mwia-wide td.mwia-card-title::before { content: none; }
  .mwia-wide td[data-label=""] { grid-column: 1 / -1; justify-content: flex-start; }
  .mwia-wide td[data-label=""]:empty { display: none; }
  .mwia-wide td.mwia-card-title { grid-column: 1 / -1; order: -1; font-size: 13px; font-weight: 600; color: #e8ebff; }
  .mwia-best { background: #1f3326; }
  .mwia-faded { opacity: .55; }
  .mwia-faded td { opacity: 1; }

  .mwia-train {
    top: calc(8px + env(safe-area-inset-top)); right: 8px; bottom: auto; left: 8px;
    width: auto; max-height: 45vh; font-size: 13px;
  }
  .mwia-train-buttons button { flex: 1; }
  .mwia-train.mwia-train-low { top: auto; bottom: calc(8px + env(safe-area-inset-bottom)); }
  .mwia-narrow-only { display: inline-block; }
}
`;

  // src/mwitools-cart.js
  var READY_TIMEOUT_MS = 5e3;
  function shoppingApi(win2) {
    try {
      const api = win2.MWITools?.shopping;
      return api && typeof api.addToCart === "function" ? api : null;
    } catch {
      return null;
    }
  }
  async function whenReady2(api) {
    const start2 = Date.now();
    while (!api.ready && Date.now() - start2 < READY_TIMEOUT_MS) {
      await new Promise((resolve2) => setTimeout(resolve2, 100));
    }
  }
  async function addToCart(win2, items) {
    const api = shoppingApi(win2);
    if (!api) {
      throw new Error("MWITools' shopping cart was not found. Check that MWITools is installed, enabled and up to date, then reload the game.");
    }
    await whenReady2(api);
    const outcome = { added: [], updated: [], present: [], failed: [] };
    for (const item of items) {
      const enhancementLevel = item.enhancementLevel || 0;
      const wanted = Math.max(1, Math.ceil(item.quantity));
      const label3 = { hrid: item.hrid, enhancementLevel };
      try {
        const have6 = api.getCartItem(item.hrid, enhancementLevel)?.quantity || 0;
        if (have6 >= wanted) {
          outcome.present.push(label3);
          continue;
        }
        const result = api.addToCart([{ itemHrid: item.hrid, enhancementLevel, quantity: wanted - have6, source: "manual" }]);
        if (result?.ok) (have6 ? outcome.updated : outcome.added).push(label3);
        else outcome.failed.push(label3);
      } catch {
        outcome.failed.push(label3);
      }
    }
    return outcome;
  }

  // src/export.js
  var INVENTORY4 = '[class*="Inventory_items"]';
  var SCAN_MS2 = 500;
  var COIN7 = "/items/coin";
  var INVENTORY_LOCATION = "/item_locations/inventory";
  var ex = { win: null, scanTimer: null, context: () => ({}), loading: null };
  var n = (x) => Math.round(x).toLocaleString("en-US");
  var coins3 = (x) => (x < 0 ? "\u2212" : "") + shortCoins(Math.abs(x));
  var words = (hrid) => String(hrid || "").split("/").pop().replace(/_/g, " ").replace(/\b\w/g, (c2) => c2.toUpperCase());
  function setExportContext(fn) {
    ex.context = fn;
  }
  function startExportButton(win2) {
    ex.win = win2;
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(".mwia-export"))) return;
      scheduleScan2();
    }).observe(document.body, { childList: true, subtree: true });
    scheduleScan2();
  }
  function scheduleScan2() {
    if (ex.scanTimer) return;
    ex.scanTimer = setTimeout(() => {
      ex.scanTimer = null;
      for (const grid of document.querySelectorAll(INVENTORY4)) {
        if (grid.nextElementSibling?.classList.contains("mwia-export") || grid.parentElement?.closest(INVENTORY4)) continue;
        const bar = document.createElement("div");
        bar.className = "mwia-export";
        bar.innerHTML = `<button type="button" class="mwia-export-btn" title="A text file with your character and the advice, to paste into a chat">\u{1F9ED} Export for chat</button>`;
        bar.querySelector("button").addEventListener("click", (event) => exportClicked(event.currentTarget));
        grid.parentElement.insertBefore(bar, grid.nextSibling);
      }
    }, SCAN_MS2);
  }
  function exportClicked(button2) {
    if (!getClientData() || pricesAge() === null) {
      const label3 = button2.textContent;
      button2.textContent = "Loading\u2026";
      ex.loading || (ex.loading = Promise.all([loadClientData(ex.win || window), loadPrices()]).finally(() => ex.loading = null));
      ex.loading.then(() => button2.textContent = "Ready \u2013 tap again").catch(() => button2.textContent = label3 + " (prices didn't load)");
      return;
    }
    let text;
    try {
      text = exportText();
    } catch (error) {
      console.warn("[MWI Advisor] export", error);
      text = `MWI Advisor export failed: ${error?.message || error}`;
    }
    deliver(text, button2);
  }
  async function deliver(text, button2) {
    const name = `mwi-advisor-${(state.character?.character?.name || "character").replace(/[^\w-]+/g, "_")}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace(/[:T]/g, "")}.txt`;
    const file = typeof File === "function" ? new File([text], name, { type: "text/plain" }) : null;
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 6e4);
    try {
      await navigator.clipboard?.writeText(text);
      if (button2) button2.textContent = "\u{1F9ED} Saved \u2013 and copied";
    } catch {
      if (button2) button2.textContent = "\u{1F9ED} Saved";
    }
  }
  function exportText() {
    const c2 = state.character;
    if (!c2) return "MWI Advisor export: the game hasn't sent the character yet \u2013 reload the page.";
    const data = getClientData();
    const items = [...state.items.values()];
    const age = pricesAge();
    const out = [];
    const section = (title, lines) => {
      if (!lines.length) return;
      out.push("", `## ${title}`, ...lines);
    };
    out.push(`# MWI Advisor export`, `Version ${scriptVersion()} \xB7 ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " ")} UTC \xB7 character ${c2.character?.name || "?"} \xB7 prices ${age === null ? "not loaded" : `${Math.round(age / 6e4)} min old`}`);
    const context2 = ex.context() || {};
    if (context2.settings) section("Settings", [JSON.stringify(context2.settings)]);
    const total = (s2) => s2.skillHrid.endsWith("/total_level");
    const skills = (c2.characterSkills || []).filter((s2) => s2.skillHrid).sort((a, b) => total(b) - total(a) || b.level - a.level || (b.experience || 0) - (a.experience || 0)).map((s2) => `${words(s2.skillHrid)} ${s2.level}${s2.experience !== void 0 && s2.experience !== null ? ` (${n(s2.experience)} XP)` : ""}`);
    section("Levels", [skills.join(" \xB7 ")]);
    const worn2 = items.filter((i) => i.itemHrid && i.itemLocationHrid && i.itemLocationHrid !== INVENTORY_LOCATION);
    section("Equipment", worn2.map((i) => `${words(i.itemLocationHrid)}: ${itemName(i.itemHrid)}${i.enhancementLevel ? ` +${i.enhancementLevel}` : ""}`));
    const drinks = Object.entries(c2.actionTypeDrinkSlotsMap || {}).map(([type, list]) => `${words(type)}: ${(list || []).map((slot) => slot?.itemHrid ? itemName(slot.itemHrid) : "empty").join(", ") || "none"}`);
    section("Drinks in slots", drinks);
    const food = Object.entries(c2.actionTypeFoodSlotsMap || {}).map(([type, list]) => `${words(type)}: ${(list || []).map((slot) => slot?.itemHrid ? itemName(slot.itemHrid) : "empty").join(", ") || "none"}`);
    section("Food in slots", food);
    const house = Object.entries(c2.characterHouseRoomMap || {}).filter(([, room]) => room?.level).map(([hrid, room]) => `${data?.houseRoomDetailMap?.[hrid]?.name || words(hrid)} ${room.level}`);
    section("House", [house.join(" \xB7 ")].filter(Boolean));
    const abilities = (c2.characterAbilities || []).filter((a) => a.abilityHrid).map((a) => `${words(a.abilityHrid)} ${a.level}${a.slotNumber ? ` (slot ${a.slotNumber})` : ""}`);
    section("Abilities", [abilities.join(" \xB7 ")].filter(Boolean));
    const stacks = items.filter((i) => i.itemHrid && i.itemLocationHrid === INVENTORY_LOCATION);
    const coinCount = stacks.filter((i) => i.itemHrid === COIN7).reduce((sum, i) => sum + (i.count || 0), 0);
    section("Coins", [n(coinCount)]);
    const pricer = data ? marketPricer((hrid) => marketEntry(hrid), data, "bid") : null;
    const priced = stacks.filter((i) => i.itemHrid !== COIN7).map((i) => {
      const m2 = marketEntry(i.itemHrid, i.enhancementLevel || 0);
      const ask = m2?.a > 0 ? m2.a : null;
      const bid = m2?.b > 0 ? m2.b : null;
      const other = bid === null && ask === null && !i.enhancementLevel ? pricer?.sell(i.itemHrid) : null;
      const how = other?.source === "bag" ? "a tenth of a bag" : other?.source === "contents" ? "what it holds" : null;
      const each = bid ?? ask ?? (how ? other.price : data?.itemDetailMap?.[i.itemHrid]?.sellPrice ?? 0);
      return { i, ask, bid, how, worth: (i.count || 0) * each };
    }).sort((a, b) => b.worth - a.worth);
    section(
      `Inventory (${priced.length} stacks, most valuable first)`,
      priced.map(({ i, ask, bid, how, worth }) => `${itemName(i.itemHrid)}${i.enhancementLevel ? ` +${i.enhancementLevel}` : ""} \xD7${n(i.count || 0)} \xB7 ask ${ask === null ? "\u2013" : coins3(ask)} \xB7 bid ${bid === null ? "\u2013" : coins3(bid)} \xB7 worth ${coins3(worth)}${how ? ` (${how})` : ""}`)
    );
    const listings = (c2.myMarketListings || []).map((l2) => `${l2.isSell ? "Sell" : "Buy"} ${itemName(l2.itemHrid)}${l2.enhancementLevel ? ` +${l2.enhancementLevel}` : ""} \xD7${n(l2.orderQuantity || 0)} @ ${coins3(Number(l2.price) || 0)}${l2.filledQuantity ? ` (${n(l2.filledQuantity)} filled)` : ""}`);
    section("Market orders", listings);
    const queue = (c2.characterActions || []).map((a) => `${actionName(a.actionHrid) || words(a.actionHrid)}${a.hasMaxCount ? ` ${n(a.currentCount || 0)}/${n(a.maxCount || 0)}` : " (no limit)"}${a.primaryItemHash ? ` \xB7 ${itemName(String(a.primaryItemHash).split("::")[2])}` : ""}`);
    section("Action queue", queue);
    for (const { title, lines } of context2.sections || []) section(title, lines);
    return out.join("\n") + "\n";
  }

  // src/history-wire.js
  var TYPES = { f32: Float32Array, u8: Uint8Array, u16: Uint16Array, u32: Uint32Array };
  var NAMES = new Map(Object.entries(TYPES).map(([name, type]) => [type, name]));
  function fromBase64(text) {
    const raw = atob(text);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }
  function unpackRecord(packed) {
    const out = {};
    for (const [k, v] of Object.entries(packed)) {
      const type = v && typeof v === "object" && TYPES[v.t];
      out[k] = type ? new type(fromBase64(v.d).buffer) : v;
    }
    return out;
  }

  // src/order-log.js
  var SEEN_KEY = "mwia-order-seen";
  var QUEUE_KEY = "mwia-order-queue";
  var DEVICE_KEY = "mwia-device";
  var MAX_QUEUE = 500;
  var PREDICTION_MS = 15 * 60 * 1e3;
  var DONE_KEEP_MS = 30 * 24 * 3600 * 1e3;
  var o = { shown: /* @__PURE__ */ new Map(), listeners: /* @__PURE__ */ new Set() };
  function normalize(listing) {
    const raw = {};
    for (const [key2, value] of Object.entries(listing)) if (value === null || ["string", "number", "boolean"].includes(typeof value)) raw[key2] = value;
    const order = {
      id: listing.id,
      item: listing.itemHrid,
      level: Number(listing.enhancementLevel) || 0,
      side: listing.isSell ? "sell" : "buy",
      price: Number(listing.price) || 0,
      quantity: Number(listing.orderQuantity) || 0,
      filled: Number(listing.filledQuantity) || 0,
      status: listing.status ?? null,
      done: listingDone(listing)
    };
    return { order, raw };
  }
  var signature = (order) => `${order.filled}|${order.status}|${order.done}`;
  var randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  function orderEvents(listings, seen = {}, { full = false, now: now2 = Date.now(), predictionFor: predictionFor2 = () => null, newId = randomId } = {}) {
    const next = { ...seen };
    const events = [];
    const present = /* @__PURE__ */ new Set();
    for (const listing of listings || []) {
      if (!listing || listing.id === void 0 || listing.id === null) continue;
      const { order, raw } = normalize(listing);
      present.add(String(order.id));
      const before = next[order.id];
      const sig = signature(order);
      if (before?.sig === sig) continue;
      const event = { uid: newId(), at: now2, kind: "seen", order, raw };
      if (!before) {
        const prediction2 = predictionFor2(order);
        if (prediction2) event.prediction = prediction2;
      }
      events.push(event);
      next[order.id] = { sig, at: now2, done: order.done, order: order.done ? void 0 : order };
    }
    for (const [id, entry] of Object.entries(next)) {
      if (full && !entry.done && !present.has(id)) {
        events.push({ uid: newId(), at: now2, kind: "gone", order: entry.order ?? { id } });
        next[id] = { sig: "gone", at: now2, done: true };
      }
      if (next[id].done && now2 - next[id].at > DONE_KEEP_MS) delete next[id];
    }
    return { events, seen: next };
  }
  function notePrediction(snapshot2, now2 = Date.now()) {
    o.shown.set(`${snapshot2.side}|${snapshot2.item}|${snapshot2.level}`, { ...snapshot2, shownAt: now2 });
  }
  function predictionFor(order, now2 = Date.now()) {
    const shown = o.shown.get(`${order.side}|${order.item}|${order.level}`);
    return shown && now2 - shown.shownAt <= PREDICTION_MS ? shown : null;
  }
  var readJson = (key2, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key2) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  };
  var writeJson = (key2, value) => {
    try {
      localStorage.setItem(key2, JSON.stringify(value));
    } catch {
    }
  };
  function deviceName() {
    let id = readJson(DEVICE_KEY, null);
    if (!id) writeJson(DEVICE_KEY, id = randomId());
    const kind = /iPhone|iPad|Android|Windows|Mac|Linux/.exec(navigator.userAgent)?.[0] || "other";
    return `${id} ${kind}`;
  }
  var queuedOrders = () => readJson(QUEUE_KEY, []);
  function dropQueued(uids) {
    const sent = new Set(uids);
    writeJson(QUEUE_KEY, queuedOrders().filter((event) => !sent.has(event.uid)));
  }
  function onOrderEvents(listener) {
    o.listeners.add(listener);
  }
  function observe(listings, full) {
    const { events, seen } = orderEvents(listings, readJson(SEEN_KEY, {}), { full, predictionFor });
    writeJson(SEEN_KEY, seen);
    if (!events.length) return;
    writeJson(QUEUE_KEY, [...queuedOrders(), ...events].slice(-MAX_QUEUE));
    for (const listener of o.listeners) listener(events.length);
  }
  function startOrderLog() {
    onStateChange((type, data) => {
      try {
        if (type === "init_character_data") observe(data.myMarketListings || [], true);
        else if (type === "market_listings_updated") {
          const full = data.myMarketListings ?? data.marketListings;
          observe(Array.isArray(full) ? full : data.endMarketListings || [], Array.isArray(full));
        }
      } catch (error) {
        console.warn("[MWI Advisor] order log", error);
      }
    });
  }

  // src/labyrinth-log.js
  var KEY2 = "mwia-laby-attempts";
  var PREV_KEY = "mwia-laby-prev";
  var MAX_KEPT = 600;
  var SKILLING = "/labyrinth_room_types/skilling";
  var FAIL = /fail/i;
  var REFRESH_MS = 2e3;
  var g = { log: null, prev: void 0, predict: null, timer: null, listeners: /* @__PURE__ */ new Set() };
  function failsOf(room) {
    let n5 = 0;
    for (const [k, v] of Object.entries(room || {})) if (FAIL.test(k) && Number.isFinite(v)) n5 += v;
    return n5;
  }
  var roomKey = (room) => room?.monsterHrid || room?.skillHrid || "";
  function roomOutcomes(before, after) {
    if (!before?.roomData || !after?.roomData) return [];
    if (before.currentFloor !== after.currentFloor || before.startedAt && after.startedAt && before.startedAt !== after.startedAt) return [];
    const out = [];
    after.roomData.forEach((row, r) => (row || []).forEach((room, c2) => {
      const was = before.roomData[r]?.[c2];
      if (!room || !was || !roomKey(room) || roomKey(room) !== roomKey(was) || was.isCleared) return;
      const failsBefore = failsOf(was);
      const fails = failsOf(room);
      for (let f = failsBefore + 1; f <= fails; f++) out.push({ row: r, col: c2, room, outcome: "loss", fails: f, failsBefore: f - 1 });
      if (room.isCleared) out.push({ row: r, col: c2, room, outcome: "win", fails, failsBefore });
    }));
    const used = (Number(before.shroudCount) || 0) - (Number(after.shroudCount) || 0);
    const cleared = out.filter((x) => x.outcome === "win");
    if (used > 0) for (const x of cleared) x.outcome = cleared.length <= used ? "shroud" : "cleared";
    return out;
  }
  var normal = (s2) => String(s2 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  function roomLoadoutId(setting, room) {
    const name = normal(roomKey(room).split("/").pop());
    if (!name || !setting) return null;
    for (const [k, v] of Object.entries(setting)) if (k.startsWith("labyrinthLoadout") && normal(k.slice(16)) === name) return v;
    return null;
  }
  function hashItem(hash2) {
    const parts = String(hash2 || "").split("::");
    const hrid = parts.find((p2) => p2.startsWith("/items/"));
    if (!hrid) return null;
    const last = parts[parts.length - 1];
    return `${hrid}+${/^\d+$/.test(last) ? last : 0}`;
  }
  function loadoutOf(character, id) {
    const l2 = id ? character?.characterLoadoutMap?.[id] : null;
    if (!l2) return null;
    const gear = {};
    for (const [location2, hash2] of Object.entries(l2.wearableMap || {})) {
      const item = hashItem(hash2);
      if (item) gear[location2.split("/").pop()] = item;
    }
    return { id: String(id), name: l2.name || "Loadout", gear, abilities: Object.values(l2.abilityMap || {}).filter(Boolean), food: (l2.foodItemHrids || []).filter(Boolean), drinks: (l2.drinkItemHrids || []).filter(Boolean) };
  }
  function worn(character) {
    const gear = {};
    for (const item of character?.characterItems || []) {
      const at2 = item.itemLocationHrid;
      if (!at2 || at2 === "/item_locations/inventory" || !(item.count ?? 1)) continue;
      gear[at2.split("/").pop()] = `${item.itemHrid}+${item.enhancementLevel || 0}`;
    }
    return gear;
  }
  function snapshot(labyrinth, character) {
    const levels = {};
    for (const s2 of character?.characterSkills || []) levels[s2.skillHrid.split("/").pop()] = s2.level;
    const info = character?.characterInfo || {};
    const shop = {};
    for (const [k, v] of Object.entries(info)) if (/^labyrinth/.test(k) && Number.isFinite(v)) shop[k.slice(9)] = v;
    const predictions = {};
    if (g.predict) {
      labyrinth.roomData.forEach((row, r) => (row || []).forEach((room, c2) => {
        if (!room || room.isCleared || !roomKey(room)) return;
        try {
          const p2 = g.predict(room, labyrinth);
          if (p2) predictions[`${r},${c2}`] = p2;
        } catch {
        }
      }));
    }
    return {
      at: Date.now(),
      labyrinth,
      levels,
      worn: worn(character),
      setting: character?.characterSetting || null,
      loadouts: character?.characterLoadoutMap || null,
      shop,
      predictions
    };
  }
  function record(x, snap, now2, late) {
    const lab = snap.labyrinth;
    const skilling = x.room.roomType === SKILLING || !!x.room.skillHrid;
    const skill = skilling ? x.room.skillHrid.split("/").pop() : null;
    const levels = {};
    for (const s2 of skilling ? [skill] : COMBAT_SKILLS) if (snap.levels[s2] !== void 0) levels[s2] = snap.levels[s2];
    const loadoutId = roomLoadoutId(snap.setting, x.room);
    const predicted = snap.predictions[`${x.row},${x.col}`] || null;
    return {
      uid: [lab.characterID, lab.startedAt || "", lab.currentFloor, x.row, x.col, x.outcome === "loss" ? "loss" : "end", x.fails].join("|"),
      at: now2,
      late: !!late,
      floor: lab.currentFloor,
      row: x.row,
      col: x.col,
      type: skilling ? "skilling" : "combat",
      what: skilling ? skill : x.room.monsterHrid.split("/").pop(),
      level: x.room.recommendedLevel,
      outcome: x.outcome,
      fails: x.fails,
      levels,
      loadout: loadoutId ? loadoutOf({ characterLoadoutMap: snap.loadouts }, loadoutId) || { id: String(loadoutId) } : null,
      worn: snap.worn,
      crates: { tea: lab.teaCrateItemHrid || null, coffee: lab.coffeeCrateItemHrid || null, food: lab.foodCrateItemHrid || null },
      shop: snap.shop,
      predicted: predicted && predicted.how === "check" ? { ...predicted, forChosen: String(predicted.best) === String(loadoutId) } : predicted,
      run: lab.startedAt || null
    };
  }
  function load2() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY2) || "null");
      if (saved && Array.isArray(saved.list)) return { list: saved.list, unsent: saved.unsent || [], piSeq: saved.piSeq || 0 };
    } catch {
    }
    return { list: [], unsent: [], piSeq: 0 };
  }
  var log = () => g.log || (g.log = load2());
  function save2() {
    const L2 = log();
    try {
      localStorage.setItem(KEY2, JSON.stringify(L2));
    } catch {
      L2.list.splice(0, Math.ceil(L2.list.length / 3));
      try {
        localStorage.setItem(KEY2, JSON.stringify(L2));
      } catch {
      }
    }
  }
  function addAttempts(attempts, { fromPi = false } = {}) {
    const L2 = log();
    const have6 = new Set(L2.list.map((a) => a.uid));
    let added = 0;
    for (const a of attempts) {
      if (!a?.uid || have6.has(a.uid)) continue;
      have6.add(a.uid);
      L2.list.push(a);
      if (!fromPi) L2.unsent.push(a.uid);
      added++;
    }
    if (!added) return 0;
    L2.list.sort((a, b) => a.at - b.at);
    if (L2.list.length > MAX_KEPT) L2.list.splice(0, L2.list.length - MAX_KEPT);
    const kept2 = new Set(L2.list.map((a) => a.uid));
    L2.unsent = L2.unsent.filter((u) => kept2.has(u));
    save2();
    for (const fn of g.listeners) fn();
    return added;
  }
  var labyrinthAttempts = () => log().list;
  var onAttemptsChanged = (fn) => g.listeners.add(fn);
  function attemptsForPi() {
    const L2 = log();
    const unsent = new Set(L2.unsent);
    return L2.list.filter((a) => unsent.has(a.uid));
  }
  function attemptsSentToPi(uids) {
    const L2 = log();
    const sent = new Set(uids);
    L2.unsent = L2.unsent.filter((u) => !sent.has(u));
    save2();
  }
  var attemptsPiSeq = () => log().piSeq;
  function attemptsFromPi(wire) {
    if (!Array.isArray(wire?.attempts)) return;
    addAttempts(wire.attempts.map((x) => x.attempt).filter(Boolean), { fromPi: true });
    const L2 = log();
    if (Number.isFinite(wire.seq)) {
      L2.piSeq = wire.seq;
      save2();
    }
  }
  function loadPrev() {
    if (g.prev === void 0) {
      try {
        g.prev = JSON.parse(localStorage.getItem(PREV_KEY) || "null");
      } catch {
        g.prev = null;
      }
    }
    return g.prev;
  }
  function keepPrev(snap) {
    g.prev = snap;
    try {
      if (snap) localStorage.setItem(PREV_KEY, JSON.stringify(snap));
      else localStorage.removeItem(PREV_KEY);
    } catch {
    }
  }
  function onLabyrinth(labyrinth, late) {
    const prev = loadPrev();
    if (prev?.labyrinth && labyrinth) {
      const now2 = Date.now();
      const found = roomOutcomes(prev.labyrinth, labyrinth).map((x) => record(x, prev, now2, late));
      if (found.length) addAttempts(found);
    }
    keepPrev(labyrinth?.isActive && Array.isArray(labyrinth.roomData) ? snapshot(labyrinth, state.character) : null);
  }
  function refreshSoon() {
    clearTimeout(g.timer);
    g.timer = setTimeout(() => {
      try {
        const lab = state.labyrinth;
        if (lab?.isActive && Array.isArray(lab.roomData) && loadPrev()?.labyrinth) keepPrev(snapshot(lab, state.character));
      } catch (error) {
        console.warn("[MWI Advisor] labyrinth log", error);
      }
    }, REFRESH_MS);
  }
  function startLabyrinthLog(deps) {
    g.predict = deps.predict;
    onStateChange((type) => {
      try {
        if (type === "init_character_data") onLabyrinth(state.labyrinth, true);
        else if (type === "labyrinth_updated") onLabyrinth(state.labyrinth, false);
        else if (state.labyrinth?.isActive) refreshSoon();
      } catch (error) {
        console.warn("[MWI Advisor] labyrinth log", error);
      }
    });
    if (state.character) onLabyrinth(state.labyrinth, true);
  }
  var labyrinthCheckChanged = () => state.labyrinth?.isActive && refreshSoon();
  function attemptSummary(list = labyrinthAttempts()) {
    const by = /* @__PURE__ */ new Map();
    for (const a of list) {
      const k = `${a.type}|${a.what}`;
      const s2 = by.get(k) || { type: a.type, what: a.what, tries: 0, wins: 0, losses: 0, shrouds: 0, predicted: 0, predictedN: 0, levels: [], last: 0 };
      if (a.outcome === "loss") s2.losses++;
      else if (a.outcome === "win") s2.wins++;
      else s2.shrouds++;
      if (a.outcome === "loss" || a.outcome === "win") {
        s2.tries++;
        s2.levels.push(a.level);
        if (Number.isFinite(a.predicted?.win)) {
          s2.predicted += a.predicted.win;
          s2.predictedN++;
        }
      }
      s2.last = Math.max(s2.last, a.at);
      by.set(k, s2);
    }
    return [...by.values()].map((s2) => ({ ...s2, won: s2.tries ? s2.wins / s2.tries : null, predicted: s2.predictedN ? s2.predicted / s2.predictedN : null, minLevel: s2.levels.length ? Math.min(...s2.levels) : null, maxLevel: s2.levels.length ? Math.max(...s2.levels) : null })).sort((a, b) => b.tries - a.tries || b.last - a.last);
  }

  // src/pi-sync.js
  var CONFIG_KEY = "mwia-pi";
  var SYNC_EVERY_MS = 15 * 60 * 1e3;
  var FIRST_SYNC_MS = 3e3;
  var ORDERS_AFTER_MS = 60 * 1e3;
  var ORDER_BATCH = 100;
  var ORDER_BATCHES = 10;
  var JOB_BATCH = 25;
  var ATTEMPT_BATCH = 100;
  var NO_STATUS = { ok: null, at: null, error: "", newest: null, piError: null, orders: null, jobs: null, labyrinth: null, plan: false };
  var p = { running: null, sending: null, jobSync: null, labSync: null, labTimer: null, ordersTimer: null, jobsTimer: null, tried: 0, status: { ...NO_STATUS }, listeners: /* @__PURE__ */ new Set() };
  function readPairing(win2) {
    const match = /(?:^#|&)mwia-pi=([A-Za-z0-9_-]+)/.exec(win2.location.hash);
    if (!match) return;
    try {
      const { u, k } = JSON.parse(atob(match[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (typeof u === "string" && /^https?:\/\//.test(u) && typeof k === "string" && k) localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: u.replace(/\/+$/, ""), key: k }));
    } catch (error) {
      console.warn("[MWI Advisor] Pi link", error);
    }
    const rest = win2.location.hash.replace(/(^#|&)mwia-pi=[^&]*/, "$1").replace(/^#&/, "#");
    win2.history.replaceState(win2.history.state, "", win2.location.pathname + win2.location.search + (rest === "#" ? "" : rest));
  }
  function piConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    } catch {
      return null;
    }
  }
  var piStatus = () => p.status;
  function onPiSync(listener) {
    p.listeners.add(listener);
  }
  function unlinkPi() {
    localStorage.removeItem(CONFIG_KEY);
    p.status = { ...NO_STATUS };
    notify(false);
  }
  function startPiSync() {
    onOrderEvents(() => {
      clearTimeout(p.ordersTimer);
      if (p.status.orders) p.ordersTimer = setTimeout(sendOrders, ORDERS_AFTER_MS);
    });
    onJobsChanged(() => {
      clearTimeout(p.jobsTimer);
      if (p.status.jobs) p.jobsTimer = setTimeout(syncJobs, ORDERS_AFTER_MS);
    });
    onAttemptsChanged(() => {
      clearTimeout(p.labTimer);
      if (p.status.labyrinth && attemptsForPi().length) p.labTimer = setTimeout(syncLabyrinth, ORDERS_AFTER_MS);
    });
    useJobSync(() => piConfig() && p.status.jobs ? syncJobs() : Promise.resolve());
    setTimeout(syncNow, FIRST_SYNC_MS);
    setInterval(syncNow, SYNC_EVERY_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && Date.now() - p.tried > SYNC_EVERY_MS) syncNow();
    });
  }
  function notify(added) {
    for (const listener of p.listeners) listener(added);
  }
  function syncNow() {
    const config = piConfig();
    if (!config) return Promise.resolve();
    p.running || (p.running = (async () => {
      p.tried = Date.now();
      let added = false;
      try {
        await loadHistory();
        const known = piReceived();
        const query = new URLSearchParams(known ? { epoch: known.epoch, items: known.items, hour: known.hour ?? "", day: known.day ?? "" } : {});
        const response = await fetch(`${config.url}/history?${query}`, { headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout?.(12e4) });
        if (response.status === 401) throw new Error("it refused the key \u2013 open a new link from it");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const wire = await response.json();
        const result = await mergeFromPi(wire, unpackRecord);
        added = result.hours > 0 || result.days > 0;
        const takesOrders = !!wire.status?.orders;
        const takesJobs = !!wire.status?.jobs;
        const takesLabyrinth = !!wire.status?.labyrinth;
        const makesPlans = !!wire.status?.plan;
        p.status = { ok: true, at: Date.now(), error: "", newest: wire.status?.newest ?? null, piError: wire.status?.lastError ?? null, orders: takesOrders ? p.status.orders || { at: null, sent: 0, waiting: queuedOrders().length, error: "" } : null, jobs: takesJobs ? p.status.jobs || { at: null, error: "" } : null, labyrinth: takesLabyrinth ? p.status.labyrinth || { at: null, error: "" } : null, plan: makesPlans };
        if (takesOrders) await sendOrders();
        if (takesJobs) await syncJobs();
        if (takesLabyrinth) await syncLabyrinth();
      } catch (error) {
        p.status = { ...p.status, ok: false, error: error.message || String(error) };
      } finally {
        p.running = null;
      }
      notify(added);
    })());
    return p.running;
  }
  function sendOrders() {
    const config = piConfig();
    if (!config || !p.status.orders) return Promise.resolve();
    p.sending || (p.sending = (async () => {
      let sent = 0;
      let error = "";
      try {
        for (let k = 0; k < ORDER_BATCHES; k++) {
          const events = queuedOrders().slice(0, ORDER_BATCH);
          if (!events.length) break;
          const response = await fetch(`${config.url}/orders`, {
            method: "POST",
            headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ device: deviceName(), events }),
            cache: "no-store",
            signal: AbortSignal.timeout?.(6e4)
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          dropQueued(events.map((event) => event.uid));
          sent += events.length;
        }
      } catch (e2) {
        error = e2.message || String(e2);
      } finally {
        p.sending = null;
      }
      p.status = { ...p.status, orders: { at: Date.now(), sent, waiting: queuedOrders().length, error } };
      notify(false);
    })());
    return p.sending;
  }
  function syncJobs() {
    const config = piConfig();
    if (!config || !p.status.jobs) return Promise.resolve();
    p.jobSync || (p.jobSync = (async () => {
      let error = "";
      const headers = { Authorization: `Bearer ${config.key}` };
      try {
        const response = await fetch(`${config.url}/jobs?after=${jobsPiSeq()}`, { headers, cache: "no-store", signal: AbortSignal.timeout?.(3e4) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        jobsFromPi(await response.json());
        for (let k = 0; k < ORDER_BATCHES; k++) {
          const all = jobsForPi();
          const reports = all.reports.slice(0, JOB_BATCH);
          const purchases = all.purchases.slice(0, Math.max(0, JOB_BATCH * 4 - reports.length));
          if (!reports.length && !purchases.length) break;
          const sent = await fetch(`${config.url}/jobs`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ device: deviceName(), reports, purchases }),
            cache: "no-store",
            signal: AbortSignal.timeout?.(3e4)
          });
          if (!sent.ok) throw new Error(`HTTP ${sent.status}`);
          jobsSentToPi({ reports: reports.map((r) => r.key), purchases: purchases.map((x) => x.uid) });
        }
      } catch (e2) {
        error = e2.message || String(e2);
      } finally {
        p.jobSync = null;
      }
      p.status = { ...p.status, jobs: { at: Date.now(), error } };
      notify(false);
    })());
    return p.jobSync;
  }
  function syncLabyrinth() {
    const config = piConfig();
    if (!config || !p.status.labyrinth) return Promise.resolve();
    p.labSync || (p.labSync = (async () => {
      let error = "";
      const headers = { Authorization: `Bearer ${config.key}` };
      try {
        for (let k = 0; k < ORDER_BATCHES; k++) {
          const response = await fetch(`${config.url}/labyrinth?after=${attemptsPiSeq()}`, { headers, cache: "no-store", signal: AbortSignal.timeout?.(3e4) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const wire = await response.json();
          attemptsFromPi(wire);
          if (!wire.more) break;
        }
        for (let k = 0; k < ORDER_BATCHES; k++) {
          const attempts = attemptsForPi().slice(0, ATTEMPT_BATCH);
          if (!attempts.length) break;
          const sent = await fetch(`${config.url}/labyrinth`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ device: deviceName(), attempts }),
            cache: "no-store",
            signal: AbortSignal.timeout?.(3e4)
          });
          if (!sent.ok) throw new Error(`HTTP ${sent.status}`);
          attemptsSentToPi(attempts.map((a) => a.uid));
        }
      } catch (e2) {
        error = e2.message || String(e2);
      } finally {
        p.labSync = null;
      }
      p.status = { ...p.status, labyrinth: { at: Date.now(), error } };
      notify(false);
    })());
    return p.labSync;
  }

  // src/price-history-ui.js
  var CURRENT_ITEM = '[class*="MarketplacePanel_currentItem"]';
  var FIRST_COLLECT_MS = 15 * 1e3;
  var SCAN_MS3 = 400;
  var RANGES = [30, 365];
  var PRELIMINARY_HOURS = 2;
  var h = { win: null, scanTimer: null, scanning: false, range: 30, open: false, listeners: /* @__PURE__ */ new Set(), exported: null, status: "" };
  var pct3 = (fraction) => `${fraction >= 0 ? "+" : "\u2212"}${Math.abs(fraction * 100).toFixed(0)}%`;
  function onHistoryChange(listener) {
    h.listeners.add(listener);
  }
  function startPriceHistory(win2) {
    h.win = win2;
    onPricesLoaded((marketData, timestamp) => {
      recordSnapshot(marketData, timestamp).then((added) => {
        if (!added) return;
        scheduleScan3(true);
        for (const listener of h.listeners) listener();
      }).catch((error) => console.warn("[MWI Advisor] price history", error));
    });
    onPiSync((added) => {
      scheduleScan3(true);
      if (added) for (const listener of h.listeners) listener();
    });
    startPiSync();
    loadHistory().catch((error) => console.warn("[MWI Advisor] price history", error));
    const collect = () => loadPrices(true).catch(() => {
    });
    setTimeout(collect, FIRST_COLLECT_MS);
    setInterval(collect, COLLECT_EVERY_MS);
    new MutationObserver(() => scheduleScan3()).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("toggle", (event) => {
      if (!event.target.matches?.(".mwia-history-more") || event.target.open === h.open) return;
      h.open = event.target.open;
      scheduleScan3(true);
    }, true);
  }
  function scheduleScan3(force = false) {
    if (force) document.querySelectorAll(".mwia-history").forEach((box) => box.dataset.version = "");
    if (h.scanTimer) return;
    h.scanTimer = setTimeout(async () => {
      h.scanTimer = null;
      if (h.scanning) return scheduleScan3();
      h.scanning = true;
      try {
        await scan2();
      } finally {
        h.scanning = false;
      }
    }, SCAN_MS3);
  }
  function currentItem() {
    const node = [...document.querySelectorAll(CURRENT_ITEM)].find(visible);
    const href = node?.querySelector("svg use")?.getAttribute("href") || node?.querySelector("svg use")?.getAttribute("xlink:href") || "";
    const id = href.split("#")[1];
    if (!node || !id) return null;
    const badge = [...node.querySelectorAll("*")].find((el) => !el.children.length && /^\+\d{1,2}$/.test(el.textContent.trim()));
    return { node, itemHrid: "/items/" + id, level: badge ? Number(badge.textContent.trim().slice(1)) : 0 };
  }
  function fullWidthRow(node) {
    const panel = node.closest('[class*="MarketplacePanel_marketplacePanel"]') || document.body;
    const width = panel.getBoundingClientRect().width;
    let row = node;
    while (row.parentElement && row.parentElement !== panel && row.getBoundingClientRect().width < 0.8 * width) row = row.parentElement;
    return row;
  }
  async function scan2() {
    const current = currentItem();
    document.querySelectorAll(".mwia-history").forEach((box2) => {
      if (!current || box2.dataset.item !== `${current.itemHrid}+${current.level}` || !document.contains(box2)) box2.remove();
    });
    if (!current) return;
    let box = document.querySelector(".mwia-history");
    const key2 = `${current.itemHrid}+${current.level}|${h.range}|${h.open}|${h.exported ? "ready" : ""}|${h.status}|${JSON.stringify(piConfig() && piStatus())}`;
    if (box && box.dataset.version === key2) return;
    if (!box) {
      box = document.createElement("div");
      box.className = "mwia-history";
      fullWidthRow(current.node).insertAdjacentElement("beforebegin", box);
    }
    box.dataset.item = `${current.itemHrid}+${current.level}`;
    box.dataset.version = key2;
    box.innerHTML = await historyHtml(current.itemHrid, current.level);
  }
  function exportHtml(piButtons = "") {
    const e2 = h.exported;
    const buttons = e2 ? `<span>${e2.items} items \xB7 ${e2.hours} hours \xB7 ${e2.days} days \xB7 ${(e2.csv.length / 1024).toFixed(0)} kB</span>
           <button data-history-export="download">\u2B07 Download CSV</button><button data-history-export="copy">\u{1F4CB} Copy</button>` : `<button data-history-export="prepare">\u2B07 Export</button>`;
    return `<div class="mwia-history-ranges mwia-history-export">${piButtons}${buttons}</div>${h.status ? `<div class="mwia-history-note">${esc(h.status)}</div>` : ""}`;
  }
  async function onExport(kind) {
    if (kind === "prepare") {
      h.status = "Preparing\u2026";
      scheduleScan3(true);
      try {
        h.exported = await exportHistory();
        h.status = "";
      } catch (error) {
        h.status = "Export failed: " + error.message;
      }
    } else if (kind === "download" && h.exported) {
      const url = URL.createObjectURL(new Blob([h.exported.csv], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `mwi-prices-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 6e4);
      h.status = "Downloaded \u2013 on an iPhone it is in the Files app (Downloads).";
    } else if (kind === "copy" && h.exported) {
      try {
        await navigator.clipboard.writeText(h.exported.csv);
        h.status = "Copied \u2013 paste it where you want it.";
      } catch (error) {
        h.status = "Could not copy (" + error.message + "); use Download instead.";
      }
    }
    scheduleScan3(true);
  }
  function sourceParts() {
    if (!piConfig()) return { note: `<div class="mwia-history-note">Saved every 30 min while the game is open, on this device.</div>`, buttons: "" };
    const st = piStatus();
    const time2 = (t4) => new Date(t4).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const synced = [];
    const problems = [];
    let text;
    if (st.ok === null) text = "Linked to your Pi; reading it\u2026";
    else if (st.ok) synced.push(["read", st.at]);
    else text = `Your Pi can't be reached (${st.error})${st.at ? `; last read ${time2(st.at)}` : ""}. Prices saved on this device fill in meanwhile.`;
    const orders = st.orders;
    if (orders?.error) problems.push(`Your orders couldn't be sent (${orders.error}); ${orders.waiting} waiting.`);
    else if (orders?.at) synced.push([`orders (${orders.waiting ? `${orders.waiting} waiting` : "all on the Pi"})`, orders.at]);
    if (st.jobs?.error) problems.push(`Job results couldn't be synced (${st.jobs.error}).`);
    else if (st.jobs?.at) synced.push(["job results", st.jobs.at]);
    if (st.labyrinth?.error) problems.push(`Labyrinth attempts couldn't be synced (${st.labyrinth.error}).`);
    else if (st.labyrinth?.at) synced.push(["Labyrinth attempts", st.labyrinth.at]);
    const byMinute = /* @__PURE__ */ new Map();
    for (const [label3, at2] of synced) {
      const key2 = time2(at2);
      if (!byMinute.has(key2)) byMinute.set(key2, []);
      byMinute.get(key2).push(label3);
    }
    const syncedText = [...byMinute].map(([minute, labels]) => `synced ${minute}: ${labels.join(", ")}`).join(" \xB7 ");
    if (st.ok) text = `From your Pi: prices ${st.newest ? time2(st.newest) : "none yet"} \xB7 ${syncedText}.${st.piError ? ` It can't reach the market now (${st.piError}).` : ""}`;
    else if (syncedText) text += ` Earlier: ${syncedText}.`;
    return {
      note: `<div class="mwia-history-note">${esc([text, ...problems].join(" "))}</div>`,
      buttons: `<button data-history-pi="sync" title="Read the Pi now">\u21BB Read Pi</button><button data-history-pi="unlink" title="Unlink the Pi">Unlink Pi</button>`
    };
  }
  function onClick(event) {
    const piButton = event.target.closest?.(".mwia-history [data-history-pi]");
    if (piButton) {
      event.preventDefault();
      event.stopPropagation();
      if (piButton.dataset.historyPi === "unlink") unlinkPi();
      else syncNow();
      return;
    }
    const exportButton = event.target.closest?.(".mwia-history [data-history-export]");
    if (exportButton) {
      event.preventDefault();
      event.stopPropagation();
      onExport(exportButton.dataset.historyExport);
      return;
    }
    const button2 = event.target.closest?.(".mwia-history [data-range]");
    if (!button2) return;
    event.preventDefault();
    event.stopPropagation();
    h.range = Number(button2.dataset.range);
    scheduleScan3(true);
  }
  async function historyHtml(itemHrid, level = 0) {
    await loadHistory();
    const summary2 = priceSummary(itemHrid, level);
    const entry = marketEntry(itemHrid, level);
    const head4 = (text) => `<div class="mwia-history-head"><b>\u{1F4C8} Usual price${level ? ` <span class="mwia-enh">+${level}</span>` : ""}</b> <span>${text}</span></div>`;
    const source = sourceParts();
    const more = (title, body) => `<details class="mwia-history-more"${h.open ? " open" : ""}><summary>${title}</summary>${body}${source.note}${exportHtml(source.buttons)}</details>`;
    if (!summary2 || summary2.hours7 < PRELIMINARY_HOURS) {
      return head4(`collecting: ${summary2 ? progressText(summary2) : "nothing yet"}`) + more("Export", "");
    }
    const versusText = (now2, side) => {
      const versus = versusUsual(now2, side.med7);
      const cls = !versus ? "" : versus.label === "above" ? "mwia-history-high" : versus.label === "below" ? "mwia-history-low" : "";
      return versus ? `<span class="${cls}">${pct3(versus.diff)} ${versus.label === "near" ? "usual" : versus.label}</span>` : "";
    };
    const coin = (v) => v ? shortCoins(v) : "\u2013";
    const sold = summary2.liquidity?.sold;
    const soldText2 = Number.isFinite(sold?.perDay) ? ` \xB7 sold \u2248${shortCoins(sold.perDay)} a day${sold.enough ? "" : " (few hours yet)"}` : "";
    const medians = `<div class="mwia-history-medians">Median 7 d: ask <b>${coin(summary2.a.med7)}</b>, bid <b>${coin(summary2.b.med7)}</b> \xB7 30 d: ask ${coin(summary2.a.med30)}, bid ${coin(summary2.b.med30)}${soldText2}</div>`;
    const askNow = entry?.a > 0 ? entry.a : null;
    const bidNow = entry?.b > 0 ? entry.b : null;
    const brief = (label3, now2, side) => `${label3} <b>${now2 > 0 ? shortCoins(now2) : "\u2013"}</b> ${versusText(now2, side)}${trendArrow(side.trend) ? " " + trendArrow(side.trend) : ""}`;
    const swing = summary2.a.swing ?? summary2.b.swing;
    const line = `<div class="mwia-history-sum">${brief("Ask", askNow, summary2.a)} \xB7 ${brief("Bid", bidNow, summary2.b)}${swing !== null ? ` \xB7 <span title="Half of the week's prices lie within this share of the 7-day median">swings \xB1${Math.round(swing * 100)}%</span>` : ""}</div>`;
    const points = h.open ? await priceSeries(itemHrid, h.range, level) : [];
    const long = h.open && h.range > 31 ? await longMedians(itemHrid, level) : null;
    const longLine = long?.days ? `<div class="mwia-history-note">90 days: ask ${long.a90 ? shortCoins(long.a90) : "\u2013"}, bid ${long.b90 ? shortCoins(long.b90) : "\u2013"} \xB7 1 year: ask ${long.a365 ? shortCoins(long.a365) : "\u2013"}, bid ${long.b365 ? shortCoins(long.b365) : "\u2013"} (${long.days} days of data)</div>` : "";
    const preliminary = !summary2.enough;
    return (preliminary ? head4(`<b class="mwia-history-prelim">preliminary</b> \xB7 ${readyText(summary2)}`) : head4(`7-day median (${summary2.hours7} h) \xB7 ${summary2.spanDays.toFixed(0)} days of data`)) + line + more(
      "Chart and details",
      medians + chartSvg(points) + `<div class="mwia-history-ranges">${RANGES.map((r) => `<button data-range="${r}" class="${r === h.range ? "mwia-active" : ""}">${r === 365 ? "1 y" : `${r} d`}</button>`).join("")}
          <span><i class="mwia-history-ask"></i>ask <i class="mwia-history-bid"></i>bid <i class="mwia-history-vol"></i>sold a day</span></div>` + longLine + (preliminary ? `<div class="mwia-history-note">Preliminary: ${progressText(summary2)}. Only ${summary2.hours7} h over ${summary2.spanDays.toFixed(1)} days, so one odd day can still move it. The Skilling tab warns only once it is ready.</div>` : "")
    );
  }
  function readyText(summary2) {
    const parts = progressText(summary2).split(" \xB7 ");
    return parts.length > 2 ? parts.slice(2).join(" \xB7 ") : "almost ready";
  }
  function progressText(summary2) {
    const hoursLeft = Math.max(0, MIN_HOURS - summary2.hours7);
    const open2 = piConfig() ? "" : " with the game open";
    const daysLeft = Math.max(0, MIN_DAYS - summary2.spanDays);
    const parts = [
      hoursLeft ? `${summary2.hours7} of ${MIN_HOURS} h` : `${MIN_HOURS} h \u2713`,
      daysLeft ? `${summary2.spanDays.toFixed(1)} of ${MIN_DAYS} days` : `${MIN_DAYS} days \u2713`
    ];
    if (daysLeft) {
      const wait = daysLeft * 24;
      parts.push(`ready in about ${wait < 20 ? Math.max(1, Math.round(wait)) + " h" : Math.round(daysLeft * 10) / 10 + " day" + (daysLeft > 1.05 ? "s" : "")}${hoursLeft ? ` and ${hoursLeft} more h${open2}` : ""}`);
    } else if (hoursLeft) {
      parts.push(`${hoursLeft} more h${open2}`);
    }
    return parts.join(" \xB7 ");
  }
  var VOLUME_BARS = 90;
  var dateText = (t4) => new Date(t4 * 3600 * 1e3).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  function chartSvg(points) {
    if (points.length < 2) return "";
    const W = 300;
    const H = 64;
    const values = points.flatMap((p2) => [p2.a, p2.b]).filter(Number.isFinite);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const t0 = points[0].t;
    const span = Math.max(1, points[points.length - 1].t - t0);
    const x = (t4) => (t4 - t0) / span * (W - 4) + 2;
    const y = (v) => high === low ? H / 2 : H - 4 - (v - low) / (high - low) * (H - 8);
    const line = (key2, cls) => {
      const path = points.filter((p2) => Number.isFinite(p2[key2])).map((p2) => `${x(p2.t).toFixed(1)},${y(p2[key2]).toFixed(1)}`).join(" ");
      return path ? `<polyline class="${cls}" points="${path}"/>` : "";
    };
    const t1 = points[points.length - 1].t;
    const bins = volumeBins(points, VOLUME_BARS, t0, t1);
    const most = Math.max(0, ...bins.filter((v) => v !== null));
    const VH = 18;
    const step = (W - 4) / VOLUME_BARS;
    const bars = most > 0 ? bins.map((v, k) => v > 0 ? `<rect x="${(2 + k * step + step * 0.15).toFixed(1)}" y="${(VH - v / most * VH).toFixed(1)}" width="${(step * 0.7).toFixed(1)}" height="${(v / most * VH).toFixed(1)}"/>` : "").join("") : "";
    const volume = bars ? `<div class="mwia-history-scale mwia-history-y mwia-history-vol-scale"><span title="The most sold a day in one bar">${esc(shortCoins(most))}/d</span></div>
        <svg class="mwia-history-volume" viewBox="0 0 ${W} ${VH}" preserveAspectRatio="none">${bars}</svg>` : "";
    return `<div class="mwia-history-plot"><div class="mwia-history-scale mwia-history-y"><span>${esc(shortCoins(high))}</span><span>${esc(shortCoins(low))}</span></div>
        <svg class="mwia-history-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${line("b", "mwia-history-bid")}${line("a", "mwia-history-ask")}</svg>
        ${volume}<span></span><div class="mwia-history-scale mwia-history-x"><span>${dateText(t0)}</span><span>${dateText((t0 + t1) / 2)}</span><span>${dateText(t1)}</span></div></div>`;
  }

  // src/consumable-guide.js
  var SCAN_MS4 = 400;
  var COMBAT2 = "/action_types/combat";
  var SETUPS_KEY = "mwia-combat-setups";
  var HOURS_PER_DAY2 = 24;
  var FIGHT_HOURS = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  var g2 = { deps: null, scanTimer: null, loading: null, statuses: /* @__PURE__ */ new Map(), hours: /* @__PURE__ */ new Map() };
  var coins4 = (n5) => (n5 < 0 ? "\u2212" : "") + shortCoins(Math.abs(n5));
  var have2 = (hrid) => state.character ? heldStock(state.character, state.items, hrid).inventory : 0;
  var slotItems = (map, type) => (state.character?.[map]?.[type] || []).map((slot) => slot?.itemHrid).filter(Boolean);
  function rememberCombatSetup(zone, setup) {
    const all = combatSetups();
    all[zone.zoneHrid] = { ...setup, tier: zone.tier || 0, at: Date.now() };
    try {
      localStorage.setItem(SETUPS_KEY, JSON.stringify(all));
    } catch {
    }
    scheduleScan4();
  }
  function combatSetupNow(zoneHrid) {
    const all = combatSetups();
    if (zoneHrid && all[zoneHrid]) return { zoneHrid, setup: all[zoneHrid] };
    const latest = Object.entries(all).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0];
    return latest ? { zoneHrid: latest[0], setup: latest[1] } : null;
  }
  function combatSetups() {
    try {
      return JSON.parse(localStorage.getItem(SETUPS_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }
  function startConsumableGuide(deps) {
    g2.deps = deps;
    onStateChange(() => scheduleScan4());
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(".mwia-guide-box"))) return;
      scheduleScan4();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick2, true);
  }
  function scheduleScan4() {
    if (g2.scanTimer) return;
    g2.scanTimer = setTimeout(() => {
      g2.scanTimer = null;
      try {
        scan3();
      } catch (error) {
        console.warn("[MWI Advisor] action window", error);
      }
    }, SCAN_MS4);
  }
  function actionByName(name) {
    const data = getClientData();
    if (!data || !name) return null;
    return Object.values(data.actionDetailMap).find((action) => action.name === name && (action.type === COMBAT2 || action.levelRequirement)) || null;
  }
  function scan3() {
    const shown = /* @__PURE__ */ new Set();
    const panels = openActionPanels();
    const leveling2 = levelingPanels();
    if ((panels.length || leveling2.length) && (!getClientData() || !pricesStamp())) {
      g2.loading || (g2.loading = g2.deps.prepare().then(scheduleScan4, (error) => console.warn("[MWI Advisor] action window", error)).finally(() => g2.loading = null));
      return;
    }
    for (const { panel, name, buttons } of panels) {
      const action = actionByName(name);
      if (!action) continue;
      const html = action.type === COMBAT2 ? combatHtml(action, panelTier(panel)) : skillingHtml(state.character ? skillingAdvice(action.hrid, g2.deps.settings()) : null);
      if (html) shown.add(placeBox(panel, buttons, action.hrid, html));
    }
    for (const { panel, kind, itemHash, target, tab, buttons } of leveling2) {
      const itemHrid = itemOfHash(itemHash);
      if (!itemHrid || !state.character || kind === "alchemy" && !tab) continue;
      const actionHrid = kind === "enhancing" ? "/actions/enhancing/enhance" : `/actions/alchemy/${tab.toLowerCase()}`;
      const html = skillingHtml(skillingAdvice(actionHrid, g2.deps.settings(), { itemHrid, target, level: levelOfHash(itemHash) }));
      if (html) shown.add(placeBox(panel, buttons, `${actionHrid}#${itemHrid}+${target ?? ""}`, html));
    }
    document.querySelectorAll(".mwia-guide-box").forEach((box) => shown.has(box) || box.remove());
  }
  function placeBox(panel, buttons, key2, html) {
    let box = panel.querySelector(".mwia-guide-box");
    if (!box) {
      box = document.createElement("div");
      box.className = "mwia-guide-box";
      if (buttons) buttons.insertAdjacentElement("beforebegin", box);
      else panel.appendChild(box);
    }
    const status2 = g2.statuses.get(key2);
    const full = html + (status2 ? `<div class="mwia-guide-status">${esc(status2)}</div>` : "");
    if (box.dataset.action !== key2 || box.dataset.html !== full) {
      box.dataset.action = key2;
      box.dataset.html = full;
      box.innerHTML = full;
    }
    return box;
  }
  var head = (title, note2) => `<div class="mwia-guide-head"><b>${title}</b> <span>${note2}</span></div>`;
  function itemLine(kind, hrid, extra = "") {
    const mark3 = { keep: "\u2713", add: "\u2795 Put in", remove: "\u2796 Take out" }[kind];
    return `<li class="mwia-guide-${kind}">${mark3} ${esc(itemName(hrid))}${extra ? ` <span>${extra}</span>` : ""}</li>`;
  }
  function cartButton(items, label3) {
    if (!items.length) return "";
    const title = items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", ");
    return `<button class="mwia-guide-cart" data-guide-cart="${esc(JSON.stringify(items))}" title="Adds to the MWITools cart: ${esc(title)}">${label3}</button>`;
  }
  function skillingHtml(entry) {
    const settings2 = g2.deps.settings();
    if (!entry) return "";
    const best = entry.betterTeas ? entry.best.result.teas : entry.current.teas;
    const current = entry.current.teas;
    const worth = new Map(entry.best.worth.map((w) => [w.itemHrid, w]));
    const perDay2 = Math.ceil(entry.best.result.drinksPerHour * HOURS_PER_DAY2);
    const gain = (hrid) => {
      const w = worth.get(hrid);
      if (!w) return "";
      return w.gainPerDay >= 0 ? ` \xB7 +${coins4(w.gainPerDay)}/day` : ` \xB7 +${coins4(w.xpPerDay)} XP/day`;
    };
    const stock = (hrid) => {
      const n5 = have2(hrid);
      return n5 < perDay2 ? `<b class="mwia-guide-low">${n5.toLocaleString("en-US")} in inventory</b>` : `${n5.toLocaleString("en-US")} in inventory`;
    };
    const lines = [
      ...best.map((hrid) => itemLine(current.includes(hrid) ? "keep" : "add", hrid, stock(hrid) + gain(hrid))),
      ...current.filter((hrid) => !best.includes(hrid)).map((hrid) => itemLine("remove", hrid))
    ];
    const verdict3 = !entry.betterTeas ? best.length ? "\u2713 Your teas are the best ones for this." : current.length ? "No tea earns back its cost here." : "\u2713 No tea earns back its cost here." : `Best teas: <b class="mwia-ok">${entry.best.result.goldPerDay >= entry.current.goldPerDay ? `+${coins4(entry.best.result.goldPerDay - entry.current.goldPerDay)}/day` : `+${coins4(entry.best.result.xpPerDay - entry.current.xpPerDay)} XP/day`}</b> over the ones in your slots now.`;
    const plan = entry.teaPlan;
    const items = plan?.items.length ? plan.items.map(({ hrid, quantity }) => ({ hrid, quantity })) : best.filter((hrid) => have2(hrid) < perDay2).map((hrid) => ({ hrid, quantity: perDay2 - have2(hrid) }));
    const label3 = plan?.items.length ? `\u{1F6D2} Teas for ${plan.hours < 1 ? Math.max(1, Math.round(plan.hours * 60)) + " min" : Math.round(plan.hours * 10) / 10 + " h"}` : "\u{1F6D2} Teas for 1 day";
    const focus = Number(settings2.skillingGold ?? 100);
    return head("\u{1F375} Teas", `MWI Advisor${entry.action.itemHrid ? ` \xB7 ${esc(adviceName(entry))}` : ""} \xB7 ${focus === 100 ? "gold" : focus === 0 ? "XP" : `${100 - focus}% XP \xB7 ${focus}% gold`}`) + (lines.length ? `<ul class="mwia-guide-list">${lines.join("")}</ul>` : "") + `<div class="mwia-guide-note">${verdict3} ${slotsLine(entry)}</div>` + cartButton(items, label3);
  }
  function panelTier(panel) {
    const select = [...panel.querySelectorAll("select")].find((el) => /^T\d+$/.test(el.selectedOptions?.[0]?.textContent.trim() || ""));
    if (select) return Number(select.selectedOptions[0].textContent.trim().slice(1));
    const shown = [...panel.querySelectorAll("*")].find((el) => !el.children.length && el.tagName !== "OPTION" && !el.closest(".mwia-guide-box") && /^T\d+$/.test(el.textContent.trim()));
    return shown ? Number(shown.textContent.trim().slice(1)) : null;
  }
  function fightsHtml(action, setup, tier) {
    const rate2 = setup.encountersPerHour;
    if (!(rate2 > 0)) return `<div class="mwia-guide-note mwia-guide-dim">Press <b>Analyze upgrades</b> again for this zone to get buttons that fill in the fights for a number of hours.</div>`;
    const analysed = setup.tier || 0;
    if (tier !== null && tier !== analysed) return `<div class="mwia-guide-note mwia-guide-dim">The advice is for T${analysed}. Pick T${tier} as the zone's tier under <b>Upgrades</b> and analyze it for drinks, food and fight counts at T${tier}.</div>`;
    const picked = g2.hours.get(action.hrid);
    const buttons = FIGHT_HOURS.map((h3) => `<button class="mwia-guide-hour${h3 === picked ? " mwia-guide-picked" : ""}" data-guide-hours="${h3}" title="${Math.max(1, Math.round(rate2 * h3)).toLocaleString("en-US")} fights">${h3}</button>`).join("");
    return `<div class="mwia-guide-sub">Fights for hours <span>\xB7 ${Math.round(rate2).toLocaleString("en-US")} an hour</span></div><div class="mwia-guide-hours">${buttons}</div>`;
  }
  function combatHtml(action, tier = null) {
    const setup = combatSetups()[action.hrid];
    if (!setup) {
      return head("\u2615 Drinks and food", "MWI Advisor") + `<div class="mwia-guide-note">No advice for ${esc(action.name)} yet: in the advisor, pick it as the zone under <b>Upgrades</b> and press <b>Analyze upgrades</b>.</div>`;
    }
    const hours = Math.max(0, (Date.now() - setup.at) / 36e5);
    const age = hours < 1 ? "less than an hour ago" : hours < 48 ? `${Math.round(hours)} h ago` : `${Math.round(hours / 24)} days ago`;
    const perDay2 = (hrid) => Math.ceil((setup.perHour?.[hrid] || 0) * HOURS_PER_DAY2);
    const stock = (hrid) => {
      const n5 = have2(hrid);
      const need2 = perDay2(hrid);
      const text = `${n5.toLocaleString("en-US")} in inventory${need2 ? `, ${need2.toLocaleString("en-US")} a day` : ""}`;
      return n5 < need2 ? `<b class="mwia-guide-low">${text}</b>` : text;
    };
    const part2 = (title, target, current) => {
      const wanted = target.filter(Boolean);
      const lines = [...wanted.map((hrid) => itemLine(current.includes(hrid) ? "keep" : "add", hrid, stock(hrid))), ...current.filter((hrid) => !wanted.includes(hrid)).map((hrid) => itemLine("remove", hrid))];
      return lines.length ? `<div class="mwia-guide-sub">${title}</div><ul class="mwia-guide-list">${lines.join("")}</ul>` : "";
    };
    const drinksNow = slotItems("actionTypeDrinkSlotsMap", COMBAT2);
    const foodNow = slotItems("actionTypeFoodSlotsMap", COMBAT2);
    const all = [...setup.drinks, ...setup.food].filter(Boolean);
    const done2 = all.every((hrid) => drinksNow.includes(hrid) || foodNow.includes(hrid)) && [...drinksNow, ...foodNow].every((hrid) => all.includes(hrid));
    const picked = setup.encountersPerHour > 0 && (tier === null || tier === (setup.tier || 0)) ? g2.hours.get(action.hrid) : null;
    const need = (hrid) => picked ? Math.ceil((setup.perHour?.[hrid] || 0) * picked) : perDay2(hrid);
    const items = all.filter((hrid) => have2(hrid) < need(hrid)).map((hrid) => ({ hrid, quantity: need(hrid) - have2(hrid) }));
    return head("\u2615 Drinks and food", `MWI Advisor \xB7 ${esc(actionName(action.hrid))}${setup.tier ? ` T${setup.tier}` : ""}, analysed ${age}`) + part2("Drinks", setup.drinks, drinksNow) + part2("Food", setup.food, foodNow) + `<div class="mwia-guide-note">${done2 ? "\u2713 Your slots match the advice." : "Set your slots as above before you start."}</div>` + fightsHtml(action, setup, tier) + cartButton(items, `\u{1F6D2} What's missing for ${picked ? `${picked} h` : "1 day"}`);
  }
  function onHours(button2) {
    const box = button2.closest(".mwia-guide-box");
    const actionHrid = box.dataset.action;
    const action = getClientData()?.actionDetailMap[actionHrid];
    const rate2 = combatSetups()[actionHrid]?.encountersPerHour;
    if (!action || !(rate2 > 0)) return;
    const hours = Number(button2.dataset.guideHours);
    const fights = Math.max(1, Math.round(rate2 * hours));
    const input = findActionPanel(action.name)?.input;
    g2.hours.set(actionHrid, hours);
    if (input) setReactInput(input, fights);
    g2.statuses.set(actionHrid, input ? `${fights.toLocaleString("en-US")} fights \u2248 ${hours} h.` : `Could not find the Fight box: enter ${fights.toLocaleString("en-US")} yourself.`);
    scheduleScan4();
  }
  async function onClick2(event) {
    const hoursButton = event.target.closest?.(".mwia-guide-box [data-guide-hours]");
    if (hoursButton) {
      event.preventDefault();
      event.stopPropagation();
      onHours(hoursButton);
      return;
    }
    const button2 = event.target.closest?.(".mwia-guide-box [data-guide-cart]");
    if (!button2) return;
    event.preventDefault();
    event.stopPropagation();
    const actionHrid = button2.closest(".mwia-guide-box").dataset.action;
    const label3 = (list) => list.map((i) => itemName(i.hrid)).join(", ");
    try {
      const outcome = await g2.deps.addToCart(JSON.parse(button2.dataset.guideCart));
      const parts = [];
      if (outcome.added.length) parts.push(`added ${label3(outcome.added)}`);
      if (outcome.updated.length) parts.push(`topped up ${label3(outcome.updated)}`);
      if (outcome.present.length) parts.push(`${label3(outcome.present)} already in the cart`);
      if (outcome.failed.length) parts.push(`could not add ${label3(outcome.failed)}`);
      g2.statuses.set(actionHrid, "Cart: " + parts.join("; ") + ".");
    } catch (error) {
      g2.statuses.set(actionHrid, error.message);
    }
    scheduleScan4();
  }

  // src/tool-notice.js
  var SCAN_MS5 = 400;
  var INVENTORY5 = "/item_locations/inventory";
  var GRID_ICONS = 8;
  var t = { deps: null, scanTimer: null, loading: null, key: "", notices: [], status: "" };
  var coins5 = (n5) => (n5 < 0 ? "\u2212" : "") + shortCoins(Math.abs(n5));
  var skillLabel2 = (skill) => skill.charAt(0).toUpperCase() + skill.slice(1);
  function startToolNotice(deps) {
    t.deps = deps;
    onStateChange(() => scheduleScan5());
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(".mwia-tool-box"))) return;
      scheduleScan5();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick3, true);
  }
  function scheduleScan5() {
    if (t.scanTimer) return;
    t.scanTimer = setTimeout(() => {
      t.scanTimer = null;
      try {
        scan4();
      } catch (error) {
        console.warn("[MWI Advisor] tool notice", error);
      }
    }, SCAN_MS5);
  }
  function equipmentGrid() {
    const button2 = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "View Stats" && visible(b));
    for (let node = button2?.parentElement; node && node !== document.body; node = node.parentElement) {
      if (node.querySelectorAll("use").length >= GRID_ICONS) return node;
    }
    return null;
  }
  function notices() {
    var _a;
    const settings2 = t.deps.settings();
    const key2 = [state.updatedAt, pricesStamp(), topActionKey(settings2)].join("|");
    if (t.key !== key2) {
      const data = getClientData();
      const equipped = {};
      const owned = {};
      for (const item of state.items.values()) {
        if (!item.itemHrid) continue;
        if (item.itemLocationHrid === INVENTORY5) (owned[_a = item.itemHrid] || (owned[_a] = [])).push(item.enhancementLevel || 0);
        else equipped[item.itemLocationHrid] = { itemHrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 };
      }
      const who = skillingCharacter(state.character, state.items, data);
      const market = skillingMarket(settings2.skillingSellAt);
      t.notices = toolTiers(who, data, market, { equipped, owned, actionFor: (skill) => topActionHrid(settings2, skill) });
      t.key = key2;
    }
    return t.notices;
  }
  function scan4() {
    const grid = state.character ? equipmentGrid() : null;
    if (grid && (!getClientData() || !pricesStamp())) {
      t.loading || (t.loading = t.deps.prepare().then(scheduleScan5, (error) => console.warn("[MWI Advisor] tool notice", error)).finally(() => t.loading = null));
      return;
    }
    const list = grid ? notices() : [];
    document.querySelectorAll(".mwia-tool-box").forEach((box2) => box2.parentElement === grid && list.length || box2.remove());
    if (!grid || !list.length) return;
    let box = grid.querySelector(":scope > .mwia-tool-box");
    if (!box) {
      box = document.createElement("div");
      box.className = "mwia-tool-box";
      grid.appendChild(box);
    }
    const html = boxHtml(list);
    if (box.dataset.html !== html) {
      box.dataset.html = html;
      box.innerHTML = html;
    }
  }
  function cartButton2(items, label3) {
    return `<button class="mwia-guide-cart" data-tool-cart="${esc(JSON.stringify(items))}" title="Adds to the MWITools cart: ${esc(items.map((i) => itemName(i.hrid)).join(", "))}">${label3}</button>`;
  }
  function rowHtml2(n5) {
    const from = n5.current ? `${esc(itemName(n5.current.itemHrid))}${n5.current.enhancementLevel ? ` +${n5.current.enhancementLevel}` : ""} \u2192 ` : "";
    let worth = "";
    if (n5.gainPerDay !== null) {
      if (n5.gainPerDay > 1) worth = ` \xB7 <span class="mwia-ok">+${coins5(n5.gainPerDay)}/day</span>${n5.paybackDays !== null && !n5.owned ? `, pays back in ${n5.paybackDays < 1 ? Math.max(1, Math.round(n5.paybackDays * 24)) + " h" : Math.round(n5.paybackDays * 10) / 10 + " days"}` : ""}`;
      else if (n5.xpPerDay > 1) worth = ` \xB7 +${coins5(n5.xpPerDay)} XP/day`;
      else if (n5.current) worth = ` \xB7 <span class="mwia-guide-low">not better than your ${esc(itemName(n5.current.itemHrid))}${n5.current.enhancementLevel ? ` +${n5.current.enhancementLevel}` : ""}</span>`;
    }
    const price = n5.owned ? "in your inventory \u2013 equip it" : n5.price === null ? "nobody sells it now" : coins5(n5.price);
    const cart = !n5.owned && n5.price !== null ? cartButton2([{ hrid: n5.itemHrid, quantity: 1 }], "\u{1F6D2}") : "";
    return `<li><span><b>${skillLabel2(n5.skill)}</b> <span class="mwia-dim">lvl ${n5.skillLevel}</span>: ${from}<b>${esc(itemName(n5.itemHrid))}</b> <span class="mwia-dim">(lvl ${n5.level})</span> \xB7 ${price}${worth}</span>${cart}</li>`;
  }
  function boxHtml(list) {
    const buyable = list.filter((n5) => !n5.owned && n5.price !== null);
    return `<div class="mwia-guide-head"><b>\u2B06 Better tools unlocked</b> <span>MWI Advisor</span></div>
        <ul class="mwia-tool-list">${list.map(rowHtml2).join("")}</ul>
        ${buyable.length > 1 ? cartButton2(buyable.map((n5) => ({ hrid: n5.itemHrid, quantity: 1 })), `\u{1F6D2} Add all ${buyable.length} (${coins5(buyable.reduce((sum, n5) => sum + n5.price, 0))})`) : ""}
        ${t.status ? `<div class="mwia-guide-status">${esc(t.status)}</div>` : ""}
        <div class="mwia-guide-status">Gold a day on what you'd make now (the top of the skill's Skilling list), sold at the ${t.deps.settings().skillingSellAt === "bid" ? "bid" : "ask"}. Payback counts selling the tool again at the bid.</div>`;
  }
  async function onClick3(event) {
    const button2 = event.target.closest?.(".mwia-tool-box [data-tool-cart]");
    if (!button2) return;
    event.preventDefault();
    event.stopPropagation();
    const names2 = (list) => list.map((i) => itemName(i.hrid)).join(", ");
    try {
      const outcome = await t.deps.addToCart(JSON.parse(button2.dataset.toolCart));
      const parts = [];
      if (outcome.added.length) parts.push(`added ${names2(outcome.added)}`);
      if (outcome.updated.length) parts.push(`topped up ${names2(outcome.updated)}`);
      if (outcome.present.length) parts.push(`${names2(outcome.present)} already in the cart`);
      if (outcome.failed.length) parts.push(`could not add ${names2(outcome.failed)}`);
      t.status = "Cart: " + parts.join("; ") + ".";
    } catch (error) {
      t.status = error.message;
    }
    scheduleScan5();
  }

  // src/tea-slots.js
  var SCAN_MS6 = 300;
  var REFRESH_MS2 = 5 * 60 * 1e3;
  var TEA_HOURS = 8;
  var LABEL = /^consumables$/i;
  var SLOTS = '[class*="ActionTypeConsumableSlots_consumableSlots"], [class*="BattlePanel_combatConsumableGrid"]';
  var MENU = '[class*="ItemSelector_menu"]';
  var MENU_ITEM = '[class*="ItemSelector_itemContainer"]';
  var NAV = '[class*="NavigationBar"]';
  var VERSION2 = typeof GM_info !== "undefined" ? GM_info.script?.version || "" : "";
  var t2 = { deps: null, scanTimer: null, loading: null, key: "", at: 0, advice: null, status: "" };
  var skillLabel3 = (skill) => skill.charAt(0).toUpperCase() + skill.slice(1);
  var SKILLS = [...SKILLING_SKILLS, ...LEVELING_SKILLS, "combat"];
  var have3 = (hrid) => heldStock(state.character, state.items, hrid).inventory;
  var iconItem = (element) => {
    const use = element.querySelector("svg use");
    const id = (use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").split("#")[1];
    return id ? "/items/" + id : null;
  };
  var ownText = (el) => [...el.childNodes].filter((n5) => n5.nodeType === 3).map((n5) => n5.textContent).join("").trim();
  var leaves = (root, test) => [...root.querySelectorAll("*")].filter((el) => test(ownText(el)));
  var ours = (el) => el.closest('[class*="mwia"]');
  function startTeaSlots(deps) {
    t2.deps = deps;
    onStateChange(() => scheduleScan6());
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(".mwia-tea-note"))) return;
      scheduleScan6();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick4, true);
  }
  function scheduleScan6() {
    if (t2.scanTimer) return;
    t2.scanTimer = setTimeout(() => {
      t2.scanTimer = null;
      try {
        scan5();
      } catch (error) {
        console.warn("[MWI Advisor] tea slots", error);
      }
    }, SCAN_MS6);
  }
  function findSlots(doc = document) {
    const label3 = leaves(doc.body, (text) => LABEL.test(text)).find((el) => visible(el) && !ours(el));
    const box = doc.querySelector(SLOTS);
    if (!label3 && !(box && visible(box))) return null;
    const headings = leaves(doc.body, (text) => SKILLS.includes(text.toLowerCase())).filter((el) => visible(el) && !ours(el) && !el.closest(NAV));
    let skill = null;
    for (let node = (label3 || box).parentElement; node && node !== doc.body && !skill; node = node.parentElement) {
      const heading = headings.find((el) => node.contains(el));
      if (heading) skill = heading.textContent.trim().toLowerCase();
    }
    if (!skill) return null;
    const row = box && visible(box) ? box : label3.nextElementSibling;
    const slots = row ? [...row.children].filter((el) => visible(el) && !ours(el)) : [];
    if (!slots.length) return { skill, error: `no tea slots next to "Consumables" (${row ? row.tagName.toLowerCase() : "nothing"} after the label)` };
    return { skill, slots, anchor: row };
  }
  function findPicker() {
    let menu = [...document.querySelectorAll(MENU)].find(visible);
    let items = menu ? [...menu.querySelectorAll(MENU_ITEM)] : [];
    if (!menu) {
      const remove = leaves(document.body, (text) => text === "Remove").find((el) => visible(el) && !ours(el));
      for (let el = remove; el && el !== document.body && !menu; el = el.parentElement) {
        if (el.parentElement?.querySelector("svg use")) {
          items = [...el.parentElement.children];
          menu = el.parentElement.parentElement || el.parentElement;
        }
      }
    }
    return menu ? { menu, items } : null;
  }
  function combatAdvice() {
    const fighting = (state.character?.characterActions || []).find((a) => a.actionHrid?.startsWith("/actions/combat/"));
    const found = combatSetupNow(fighting?.actionHrid);
    if (!found) return null;
    const { zoneHrid, setup } = found;
    const right = [...setup.drinks || [], ...setup.food || []].filter(Boolean);
    return { combat: true, name: actionName(zoneHrid) + (setup.tier ? ` T${setup.tier}` : ""), teas: right, perHour: setup.perHour || {} };
  }
  function adviceFor(skill) {
    if (skill === "combat") return combatAdvice();
    const type = `/action_types/${skill}`;
    const data = getClientData();
    const job = (state.character?.characterActions || []).find((a) => data.actionDetailMap[a.actionHrid]?.type === type);
    if (!job) return null;
    const settings2 = t2.deps.settings();
    const drinks = (state.character.actionTypeDrinkSlotsMap?.[type] || []).map((slot) => slot?.itemHrid || null);
    const item = LEVELING_SKILLS.includes(skill) ? { itemHrid: itemOfHash(job.primaryItemHash), target: job.enhancingMaxLevel, level: levelOfHash(job.primaryItemHash) } : null;
    const key2 = [job.actionHrid, JSON.stringify(item), JSON.stringify(drinks), pricesStamp(), topActionKey(settings2)].join("|");
    if (t2.key !== key2 || Date.now() - t2.at > REFRESH_MS2) {
      const entry = skillingAdvice(job.actionHrid, settings2, item);
      t2.advice = entry && { action: entry.action, name: adviceName(entry), entry, teas: entry.betterTeas ? entry.best.result.teas : entry.current.teas, drinks };
      t2.key = key2;
      t2.at = Date.now();
    }
    return t2.advice;
  }
  function scan5() {
    const found = state.character ? findSlots() : null;
    if (found && !found.error && (!getClientData() || !pricesStamp())) {
      t2.loading || (t2.loading = t2.deps.prepare().then(scheduleScan6, (error) => console.warn("[MWI Advisor] tea slots", error)).finally(() => t2.loading = null));
      return;
    }
    const advice = found && !found.error && getClientData() ? adviceFor(found.skill) : null;
    const marked = /* @__PURE__ */ new Set();
    let note2 = null;
    let noteAt = null;
    if (found?.error) {
      note2 = `<span class="mwia-dim">MWI Advisor${VERSION2 ? " " + VERSION2 : ""}: can't mark the ${found.skill === "combat" ? "drinks and food" : "teas"} \u2013 ${esc(found.error)}.</span>`;
      noteAt = (leaves(document.body, (text) => LABEL.test(text)).find(visible) || {}).parentElement;
    } else if (advice) {
      const right = new Set(advice.teas);
      const inSlots = found.slots.map(iconItem);
      const missing = advice.teas.filter((hrid) => !inSlots.includes(hrid));
      let empty = missing.length;
      found.slots.forEach((slot, i) => {
        if (/require/i.test(slot.textContent)) return;
        const hrid = inSlots[i];
        const wrong = hrid ? !right.has(hrid) : empty-- > 0;
        if (wrong) {
          const none = advice.combat ? "the advice leaves it empty" : "no tea pays";
          mark2(slot, "wrong", hrid ? `Not for ${advice.name}: ${advice.teas.length ? "use " + advice.teas.map(itemName).join(", ") : none}` : `Empty: put in ${missing.map(itemName).join(" or ")}`);
          marked.add(slot);
        }
      });
      const picker = findPicker();
      if (picker) {
        const anyWrong = inSlots.some((hrid) => hrid && !right.has(hrid));
        for (const item of picker.items) {
          const hrid = iconItem(item);
          const good = hrid ? right.has(hrid) && !inSlots.includes(hrid) : /^remove$/i.test(item.textContent.trim()) && anyWrong && !missing.length;
          if (good) {
            mark2(item, "right", hrid ? `Right for ${advice.name}` : advice.combat ? "Take the wrong one out" : "Take the wrong tea out");
            marked.add(item);
          }
        }
        note2 = noteHtml(advice);
        noteAt = note2 ? picker.menu : null;
      }
    }
    document.querySelectorAll("[data-mwia-tea]").forEach((el) => marked.has(el) || unmark(el));
    document.querySelectorAll(".mwia-tea-note").forEach((box2) => box2.parentElement === noteAt && note2 || box2.remove());
    if (!note2 || !noteAt) return;
    let box = noteAt.querySelector(":scope > .mwia-tea-note");
    if (!box) {
      box = document.createElement("div");
      box.className = "mwia-tea-note";
      noteAt.appendChild(box);
    }
    if (box.dataset.html !== note2) {
      box.dataset.html = note2;
      box.innerHTML = note2;
    }
  }
  function mark2(el, kind, title) {
    if (el.dataset.mwiaTea !== kind) el.dataset.mwiaTea = kind;
    if (el.title !== title) el.title = title;
  }
  function unmark(el) {
    delete el.dataset.mwiaTea;
    el.removeAttribute("title");
  }
  function noteHtml(advice) {
    const lacking = advice.teas.filter((hrid) => have3(hrid) <= 0);
    if (!lacking.length) return t2.status ? `<div class="mwia-guide-status">${esc(t2.status)}</div>` : "";
    if (advice.combat) return combatNoteHtml(advice, lacking);
    const perTea = Math.ceil(TEA_HOURS * advice.entry.current.drinksPerHour);
    const items = advice.teas.map((hrid) => ({ hrid, quantity: perTea - have3(hrid) })).filter((i) => i.quantity > 0);
    const button2 = items.length ? `<button class="mwia-guide-cart" data-tea-cart="${esc(JSON.stringify(items))}" title="Adds to the MWITools cart: ${esc(items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", "))}">\u{1F6D2} ${TEA_HOURS} h of teas</button>` : "";
    return `<div><b>Missing for ${esc(advice.name)}:</b> ${esc(lacking.map(itemName).join(", "))}</div>
        <div class="mwia-dim">${TEA_HOURS} h is ${perTea} of each (${skillLabel3(advice.action.type.split("/").pop())} job first in your queue).</div>
        ${button2}${t2.status ? `<div class="mwia-guide-status">${esc(t2.status)}</div>` : ""}`;
  }
  function combatNoteHtml(advice, lacking) {
    const need = (hrid) => Math.ceil(TEA_HOURS * (advice.perHour[hrid] || 0));
    const items = advice.teas.map((hrid) => ({ hrid, quantity: need(hrid) - have3(hrid) })).filter((i) => i.quantity > 0);
    const button2 = items.length ? `<button class="mwia-guide-cart" data-tea-cart="${esc(JSON.stringify(items))}" title="Adds to the MWITools cart: ${esc(items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", "))}">\u{1F6D2} ${TEA_HOURS} h of drinks and food</button>` : "";
    return `<div><b>Missing for ${esc(advice.name)}:</b> ${esc(lacking.map(itemName).join(", "))}</div>
        <div class="mwia-dim">${TEA_HOURS} h at the pace of the advisor's Upgrades analysis for ${esc(advice.name)}.</div>
        ${button2}${t2.status ? `<div class="mwia-guide-status">${esc(t2.status)}</div>` : ""}`;
  }
  async function onClick4(event) {
    const button2 = event.target.closest?.(".mwia-tea-note [data-tea-cart]");
    if (!button2) return;
    event.preventDefault();
    event.stopPropagation();
    const names2 = (list) => list.map((i) => itemName(i.hrid)).join(", ");
    try {
      const outcome = await t2.deps.addToCart(JSON.parse(button2.dataset.teaCart));
      const parts = [];
      if (outcome.added.length) parts.push(`added ${names2(outcome.added)}`);
      if (outcome.updated.length) parts.push(`topped up ${names2(outcome.updated)}`);
      if (outcome.present.length) parts.push(`${names2(outcome.present)} already in the cart`);
      if (outcome.failed.length) parts.push(`could not add ${names2(outcome.failed)}`);
      t2.status = "Cart: " + parts.join("; ") + ".";
    } catch (error) {
      t2.status = error.message;
    }
    scheduleScan6();
  }

  // src/loadout-advice.js
  var SCAN_MS7 = 400;
  var STORE_KEY = "mwia-loadout-advice";
  var KEEP = 8;
  var CART_HOURS = [8, 24];
  var WAIT_MS = 3e3;
  var COMBAT_ACTIONS = "/actions/combat/";
  var g3 = { deps: null, scanTimer: null, running: null, failed: /* @__PURE__ */ new Map(), status: "", retry: null, loading: null };
  var ours2 = (el) => el.closest('[class*="mwia"]');
  var ownText2 = (el) => [...el.childNodes].filter((n5) => n5.nodeType === 3).map((n5) => n5.textContent).join("").trim();
  var have4 = (hrid) => state.character ? heldStock(state.character, state.items, hrid).inventory : 0;
  var n2 = (v) => Math.round(v).toLocaleString("en-US");
  function startLoadoutAdvice(deps) {
    g3.deps = deps;
    onStateChange(() => scheduleScan7());
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(".mwia-loadout-box"))) return;
      scheduleScan7();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick5, true);
  }
  function scheduleScan7() {
    if (g3.scanTimer) return;
    g3.scanTimer = setTimeout(() => {
      g3.scanTimer = null;
      try {
        scan6();
      } catch (error) {
        console.warn("[MWI Advisor] loadout panel", error);
      }
    }, SCAN_MS7);
  }
  function queuedFight(character) {
    const action = (character?.characterActions || []).find((a) => a?.actionHrid?.startsWith(COMBAT_ACTIONS) && !a.isDone);
    return action ? { zoneHrid: action.actionHrid, tier: action.difficultyTier || 0, action } : null;
  }
  function fightLoadout(character, fight) {
    const loadouts = combatLoadouts(character);
    if (!loadouts.length) return null;
    for (const [key2, value] of Object.entries(fight?.action || {})) {
      if (!/loadout/i.test(key2) || value === null || value === void 0 || value === "" || value === 0) continue;
      const named = loadouts.find((l2) => l2.id === String(value));
      if (named) return { loadout: named, why: "the loadout set for the queued fight" };
    }
    const fallback = loadouts.find((l2) => l2.isDefault && l2.actionTypeHrid === "/action_types/combat") || loadouts.find((l2) => l2.isDefault);
    return fallback ? { loadout: fallback, why: "your default combat loadout" } : { loadout: loadouts[0], why: "your first combat loadout" };
  }
  function findLoadoutPanel(doc = document) {
    const button2 = [...doc.querySelectorAll("button")].find((b) => /^equip loadout$/i.test(b.textContent.trim()) && visible(b) && !ours2(b));
    if (!button2) return null;
    const heading = (root, label3) => [...root.querySelectorAll("*")].find((el) => ownText2(el).toLowerCase() === label3 && !ours2(el) && visible(el));
    let panel = button2.parentElement;
    while (panel && panel !== doc.body && !(heading(panel, "abilities") && heading(panel, "consumables"))) panel = panel.parentElement;
    if (!panel || panel === doc.body) return null;
    const abilitiesHead = heading(panel, "abilities");
    const consumablesHead = heading(panel, "consumables");
    const data = getClientData();
    const follows = (a, b) => !!(a.compareDocumentPosition(b) & 4);
    const known = (kind, hrid) => !data || (kind === "abilities" ? data.abilityDetailMap?.[hrid] : data.itemDetailMap?.[hrid]);
    const icons = [];
    for (const use of panel.querySelectorAll("svg use")) {
      if (ours2(use)) continue;
      const id = (use.getAttribute("href") || use.getAttribute("xlink:href") || "").split("#")[1];
      if (!id) continue;
      const kind = follows(consumablesHead, use) ? "items" : follows(abilitiesHead, use) ? "abilities" : null;
      if (kind && known(kind, `/${kind}/${id}`)) icons.push({ use, kind, hrid: `/${kind}/${id}` });
    }
    const slots = (kind) => icons.filter((icon) => icon.kind === kind).map(({ use, hrid }) => {
      let el = use.closest("svg");
      for (let up = el.parentElement; up && up !== panel && !up.contains(abilitiesHead) && !up.contains(consumablesHead) && up.querySelectorAll("svg").length === 1; up = up.parentElement) el = up;
      return { el, hrid };
    });
    return { panel, abilities: { slots: slots("abilities") }, consumables: { slots: slots("items") } };
  }
  var loadoutContent = (l2) => [...Object.values(l2.abilityMap || {}), ...l2.foodItemHrids || [], ...l2.drinkItemHrids || []].filter(Boolean).sort().join(",");
  function shownLoadout(found, character, prefer = null) {
    const shown = [...found.abilities.slots, ...found.consumables.slots].map((s2) => s2.hrid).filter(Boolean).sort().join(",");
    const fits = combatLoadouts(character).filter((l2) => loadoutContent(l2) === shown);
    return fits.find((l2) => l2.id === prefer?.id) || fits[0] || null;
  }
  function setupSig(profile, fight, settings2) {
    return JSON.stringify([
      Object.entries(profile.equipment || {}).sort().map(([slot, e2]) => `${slot}:${e2.hrid}+${e2.enhancementLevel || 0}`),
      (profile.abilities || []).map((a) => a?.hrid || null),
      (profile.drinks || []).filter(Boolean).sort(),
      (profile.food || []).filter(Boolean).sort(),
      fight.zoneHrid,
      fight.tier,
      Number(settings2.goldWeight) || 0,
      !!settings2.acceptRareDeaths,
      !!settings2.countLevels
    ]);
  }
  function stored() {
    try {
      const list = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }
  function store4(entry) {
    const list = [entry, ...stored().filter((e2) => e2.sig !== entry.sig)].slice(0, KEEP);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch {
    }
  }
  function adviceFor2(sig) {
    const list = stored();
    const own = list.find((e2) => e2.sig === sig);
    if (own) return { entry: own, done: false };
    const reached = list.find((e2) => e2.finalSig === sig);
    return reached ? { entry: reached, done: true } : null;
  }
  var slotsOf = (profile, counts) => ({
    special: counts.special ? profile.abilities?.[0]?.hrid || null : null,
    abilities: (profile.abilities || []).slice(1, counts.abilities + 1).map((a) => a?.hrid || null),
    drinks: (profile.drinks || []).slice(0, counts.drinks),
    food: (profile.food || []).slice(0, counts.food)
  });
  var summary = (r) => r && { xp: r.xpTotal || 0, profit: r.profit || 0, deaths: r.deaths || 0, encounters: r.encounters || 0, consumables: r.consumables || {} };
  function adviceEntry(result, fight, loadout, settings2) {
    return {
      sig: setupSig(result.start, fight, settings2),
      finalSig: setupSig(result.final, fight, settings2),
      at: Date.now(),
      zoneHrid: fight.zoneHrid,
      tier: fight.tier,
      loadoutId: loadout.id,
      loadoutName: loadout.name || "Loadout",
      rounds: result.rounds,
      start: slotsOf(result.start, slotCounts(result.start, getClientData())),
      final: slotsOf(result.final, slotCounts(result.final, getClientData())),
      before: summary(result.before),
      after: summary(result.after)
    };
  }
  function cartItems(entry, hours, haveOf = have4) {
    const wanted = [...entry.final.drinks, ...entry.final.food].filter(Boolean);
    return wanted.map((hrid) => ({ hrid, quantity: Math.ceil((entry.after.consumables[hrid] || 0) * hours) - haveOf(hrid) })).filter((i) => i.quantity > 0);
  }
  function scan6() {
    const found = state.character ? findLoadoutPanel() : null;
    const marked = /* @__PURE__ */ new Set();
    let html = null;
    let at2 = null;
    if (found) {
      const fight = queuedFight(state.character);
      const chosen = fight ? fightLoadout(state.character, fight) : null;
      if (fight && chosen) {
        const shown = shownLoadout(found, state.character, chosen.loadout);
        at2 = found;
        html = boxHtml2(found, fight, chosen, shown, marked);
      }
    }
    document.querySelectorAll("[data-mwia-slot]").forEach((el) => marked.has(el) || unmark2(el));
    document.querySelectorAll(".mwia-loadout-box").forEach((box2) => html && at2 && found.panel.contains(box2) || box2.remove());
    if (!html || !at2) return;
    let box = found.panel.querySelector(".mwia-loadout-box");
    if (!box) {
      box = document.createElement("div");
      box.className = "mwia-loadout-box";
      found.panel.appendChild(box);
    }
    if (box.dataset.html !== html) {
      box.dataset.html = html;
      box.innerHTML = html;
    }
  }
  var fightName = (fight) => esc(actionName(fight.zoneHrid) || fight.zoneHrid.split("/").pop()) + (fight.tier ? ` T${fight.tier}` : "");
  var head2 = (note2) => `<div class="mwia-guide-head"><b>\u{1F9ED} Loadout for your next fight</b> <span>MWI Advisor${note2 ? " \xB7 " + note2 : ""}</span></div>`;
  function boxHtml2(found, fight, chosen, shown, marked) {
    const { loadout, why } = chosen;
    const name = esc(loadout.name || "Loadout");
    if (shown && shown.id !== loadout.id) {
      return head2(fightName(fight)) + `<div class="mwia-guide-note">Your next fight, <b>${fightName(fight)}</b>, uses <b>${name}</b> (${why}). Open that loadout for its abilities, drinks and food.</div>`;
    }
    const settings2 = g3.deps.settings();
    const profile = g3.deps.profileOf(loadout);
    if (!profile) {
      g3.loading || (g3.loading = g3.deps.prepare().then(scheduleScan7, (error) => console.warn("[MWI Advisor] loadout panel", error)).finally(() => g3.loading = null));
      return head2(fightName(fight)) + `<div class="mwia-guide-note mwia-guide-dim">Loading the game data\u2026</div>`;
    }
    const sig = setupSig(profile, fight, settings2);
    const known = adviceFor2(sig);
    const read = [...found.abilities.slots.map((s2) => abilityName(s2.hrid)), ...found.consumables.slots.map((s2) => itemName(s2.hrid))];
    const unsure = shown ? "" : `<div class="mwia-guide-note mwia-guide-dim">Can't tell which saved loadout this is (read: ${esc(read.join(", ") || "nothing")}); the advice is for <b>${name}</b> as saved.</div>`;
    const intro = `<div class="mwia-guide-note">Next fight: <b>${fightName(fight)}</b> with <b>${name}</b> <span class="mwia-guide-dim">(${why})</span></div>`;
    if (!known) {
      if (g3.running?.sig === sig) {
        const pct6 = g3.running.total ? Math.round(100 * g3.running.done / g3.running.total) : 0;
        return head2("simulating") + intro + unsure + `<div class="mwia-guide-note">Simulating this loadout in ${fightName(fight)}\u2026 round ${Math.min(g3.running.round, LOADOUT_ROUNDS)} of at most ${LOADOUT_ROUNDS}, ${pct6}%</div><div class="mwia-guide-note mwia-guide-dim">A round stops early once nothing more helps. You can keep playing meanwhile.</div>`;
      }
      const failed = g3.failed.get(sig);
      if (failed) return head2("") + intro + unsure + `<div class="mwia-guide-note mwia-guide-low">Could not work it out: ${esc(failed)}</div>` + againButton("Try again");
      if (!g3.running && !g3.deps.busy()) start(loadout, fight, profile, sig);
      else waitAndLook();
      return head2("") + intro + unsure + `<div class="mwia-guide-note mwia-guide-dim">${g3.running ? "Waiting for the other loadout's simulation\u2026" : "Waiting for the advisor's other analysis\u2026"}</div>`;
    }
    return head2(ageText(known.entry.at)) + intro + unsure + adviceHtml(known, shown ? found : null, marked) + statusHtml();
  }
  function waitAndLook() {
    clearTimeout(g3.retry);
    g3.retry = setTimeout(scheduleScan7, WAIT_MS);
  }
  function start(loadout, fight, profile, sig) {
    g3.running = { sig, done: 0, total: 0, round: 1 };
    g3.status = "";
    const settings2 = { ...g3.deps.settings() };
    g3.deps.analyze(loadout, { zoneHrid: fight.zoneHrid, tier: fight.tier }, (done2, total, round) => {
      g3.running = { sig, done: done2, total, round };
      scheduleScan7();
    }).then((result) => {
      const entry = adviceEntry(result, fight, loadout, settings2);
      entry.sig = sig;
      store4(entry);
    }).catch((error) => g3.failed.set(sig, error?.message || String(error))).finally(() => {
      g3.running = null;
      scheduleScan7();
    });
  }
  var ageText = (at2) => {
    const hours = Math.max(0, (Date.now() - at2) / 36e5);
    return hours < 1 ? "simulated less than an hour ago" : hours < 48 ? `simulated ${Math.round(hours)} h ago` : `simulated ${Math.round(hours / 24)} days ago`;
  };
  function itemLine2(kind, text, extra = "") {
    const mark3 = { keep: "\u2713", add: "\u2795 Put in", remove: "\u2796 Take out" }[kind];
    return `<li class="mwia-guide-${kind}">${mark3} ${text}${extra ? ` <span>${extra}</span>` : ""}</li>`;
  }
  function part(title, final, start2, label3, extra = () => "") {
    const want = final.filter(Boolean);
    const now2 = start2.filter(Boolean);
    const lines = [...want.map((h3) => itemLine2(now2.includes(h3) ? "keep" : "add", esc(label3(h3)), extra(h3))), ...now2.filter((h3) => !want.includes(h3)).map((h3) => itemLine2("remove", esc(label3(h3))))];
    return lines.length ? `<div class="mwia-guide-sub">${title}</div><ul class="mwia-guide-list">${lines.join("")}</ul>` : "";
  }
  function gainText(entry) {
    const { before, after } = entry;
    if (!before || !after) return "";
    const pct6 = (a, b) => b > 0 ? Math.round(100 * (a - b) / b) : 0;
    const xp = pct6(after.xp, before.xp);
    const profit = after.profit - before.profit;
    const sign = (v) => v > 0 ? "+" : v < 0 ? "\u2212" : "\xB1";
    const deaths = after.deaths > 0.05 ? `, ${after.deaths.toFixed(1)} deaths/h` : "";
    return `<b class="${xp >= 0 ? "mwia-ok" : "mwia-guide-low"}">${sign(xp)}${Math.abs(xp)}% XP/h</b>, <b class="${profit >= 0 ? "mwia-ok" : "mwia-guide-low"}">${sign(profit)}${shortCoins(Math.abs(profit))}/h profit</b>${deaths} over the loadout as it is`;
  }
  function adviceHtml(known, found, marked) {
    const { entry, done: done2 } = known;
    const { start: start2, final } = entry;
    const same2 = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const unchanged = done2 || same2(start2.abilities.filter(Boolean), final.abilities.filter(Boolean)) && same2(start2.special, final.special) && same2(start2.drinks.filter(Boolean).sort(), final.drinks.filter(Boolean).sort()) && same2(start2.food.filter(Boolean).sort(), final.food.filter(Boolean).sort());
    const perHour = (h3) => entry.after.consumables[h3] || 0;
    const stock = (h3) => {
      const need = Math.ceil(perHour(h3) * 8);
      const text = `${n2(have4(h3))} in inventory${perHour(h3) ? `, ${n2(perHour(h3))}/h` : ""}`;
      return have4(h3) < need ? `<b class="mwia-guide-low">${text}</b>` : text;
    };
    const from = done2 ? final : start2;
    const order = final.abilities.filter(Boolean);
    const newOrder = order.length > 1 && !same2(order, from.abilities.filter(Boolean));
    let html = part("Abilities", [final.special, ...final.abilities], [from.special, ...from.abilities], abilityName) + (newOrder ? `<div class="mwia-guide-note">In this order: <b>${order.map((h3) => esc(abilityName(h3))).join(" \u2192 ")}</b></div>` : "") + part("Drinks", final.drinks, from.drinks, itemName, stock) + part("Food", final.food, from.food, itemName, stock);
    html += `<div class="mwia-guide-note">${unchanged ? "\u2713 This loadout is the best the advisor found for this fight." : `Change it as above and save the loadout: ${gainText(entry)}.`}</div>`;
    if (found) markSlots(found, final, marked);
    const buttons = CART_HOURS.map((hours) => cartButton3(cartItems(entry, hours), hours)).join(" ");
    html += `<div class="mwia-guide-sub">Drinks and food for <span>\xB7 at the simulated pace, less what you have</span></div><div class="mwia-guide-hours">${buttons}</div>`;
    return html + againButton("\u21BB Simulate again");
  }
  var againButton = (label3) => `<button class="mwia-guide-cart" data-loadout-again="1">${label3}</button>`;
  var statusHtml = () => g3.status ? `<div class="mwia-guide-status">${esc(g3.status)}</div>` : "";
  function cartButton3(items, hours) {
    if (!items.length) return `<button class="mwia-guide-cart" disabled title="You have enough for ${hours} h">\u2713 ${hours} h</button>`;
    const title = items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", ");
    return `<button class="mwia-guide-cart" data-loadout-cart="${esc(JSON.stringify(items))}" title="Adds to the MWITools cart: ${esc(title)}">\u{1F6D2} ${hours} h</button>`;
  }
  function markSlots(found, final, marked) {
    const abilities = new Set([final.special, ...final.abilities].filter(Boolean));
    const consumables = new Set([...final.drinks, ...final.food].filter(Boolean));
    const check = (slots, keep2, label3) => {
      for (const slot of slots) {
        if (!slot.hrid || keep2.has(slot.hrid)) continue;
        const title = `Take out ${label3(slot.hrid)} (MWI Advisor)`;
        if (slot.el.dataset.mwiaSlot !== "wrong") slot.el.dataset.mwiaSlot = "wrong";
        if (slot.el.title !== title) slot.el.title = title;
        marked.add(slot.el);
      }
    };
    check(found.abilities.slots, abilities, abilityName);
    check(found.consumables.slots, consumables, itemName);
  }
  function unmark2(el) {
    delete el.dataset.mwiaSlot;
    el.removeAttribute("title");
  }
  async function onClick5(event) {
    const again = event.target.closest?.(".mwia-loadout-box [data-loadout-again]");
    if (again) {
      event.preventDefault();
      event.stopPropagation();
      forget();
      scheduleScan7();
      return;
    }
    const button2 = event.target.closest?.(".mwia-loadout-box [data-loadout-cart]");
    if (!button2) return;
    event.preventDefault();
    event.stopPropagation();
    const names2 = (list) => list.map((i) => itemName(i.hrid)).join(", ");
    try {
      const outcome = await g3.deps.addToCart(JSON.parse(button2.dataset.loadoutCart));
      const parts = [];
      if (outcome.added.length) parts.push(`added ${names2(outcome.added)}`);
      if (outcome.updated.length) parts.push(`topped up ${names2(outcome.updated)}`);
      if (outcome.present.length) parts.push(`${names2(outcome.present)} already in the cart`);
      if (outcome.failed.length) parts.push(`could not add ${names2(outcome.failed)}`);
      g3.status = "Cart: " + parts.join("; ") + ".";
    } catch (error) {
      g3.status = error.message;
    }
    scheduleScan7();
  }
  function forget() {
    const fight = queuedFight(state.character);
    const chosen = fight ? fightLoadout(state.character, fight) : null;
    const profile = chosen ? g3.deps.profileOf(chosen.loadout) : null;
    if (!profile) return;
    const sig = setupSig(profile, fight, g3.deps.settings());
    g3.failed.delete(sig);
    g3.status = "";
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(stored().filter((e2) => e2.sig !== sig && e2.finalSig !== sig)));
    } catch {
    }
  }

  // src/labyrinth.js
  var SAFE_WIN = 0.9;
  var RISKY_WIN = 0.5;
  var MIN_LEVEL = 5;
  var MAX_LEVEL = 200;
  var COARSE_LEVELS = [5, ...Array.from({ length: 20 }, (_, i) => 10 * (i + 1))];
  var FINE_STEP = 2;
  var MAX_FINE = 12;
  var FLOOR_STEP = 30;
  var FLOOR_ONE_LEVEL = 30;
  var floorLevel = (floor) => FLOOR_ONE_LEVEL + (floor - 1) * FLOOR_STEP;
  var floorAt = (level) => level === null || level < FLOOR_ONE_LEVEL ? 0 : 1 + Math.floor((level - FLOOR_ONE_LEVEL) / FLOOR_STEP);
  var LAB_ACCURACY = {
    fast: { rooms: 20, improveRooms: 40 },
    normal: { rooms: 40, improveRooms: 80 },
    thorough: { rooms: 80, improveRooms: 160 }
  };
  var CRATE_TIERS = ["basic", "advanced", "expert"];
  var CRATE_KINDS = { coffee: "Coffee crate", food: "Food crate" };
  var crateHrid = (tier, kind) => `/items/${tier}_${kind}_crate`;
  var LABYRINTH = "/action_types/labyrinth";
  var seedFor2 = (index) => Math.imul(index + 1, 2654435761) >>> 1 || 1;
  function labyrinthMonsters(data) {
    return Object.values(data.combatMonsterDetailMap || {}).filter((m2) => m2.isLabyrinthMonster).sort((a, b) => a.name.localeCompare(b.name)).map((m2) => m2.hrid);
  }
  function slottedCrate(character, kind) {
    const slots = [...character?.actionTypeDrinkSlotsMap?.[LABYRINTH] || [], ...character?.actionTypeFoodSlotsMap?.[LABYRINTH] || []];
    for (const slot of slots) {
      const tier = CRATE_TIERS.find((t4) => slot?.itemHrid === crateHrid(t4, kind));
      if (tier) return tier;
    }
    return null;
  }
  function chosenCrates(settings2, character) {
    const pick2 = (kind) => {
      const value = settings2[kind === "coffee" ? "labyCoffee" : "labyFood"] || "slots";
      if (value === "slots") return slottedCrate(character, kind);
      return CRATE_TIERS.includes(value) ? value : null;
    };
    return { coffee: pick2("coffee"), food: pick2("food") };
  }
  function crateBuffs(data, crates) {
    const buffs = [];
    for (const [kind, tier] of Object.entries(crates)) {
      if (!tier) continue;
      for (const buff of data.labyrinthCrateDetailMap?.[crateHrid(tier, kind)] || []) buffs.push({ ...buff, uniqueHrid: `${buff.uniqueHrid}#${kind}`, duration: 0 });
    }
    return buffs;
  }
  function labyrinthLoadouts(character) {
    return Object.entries(character?.characterLoadoutMap || {}).filter(([, l2]) => l2?.actionTypeHrid === LABYRINTH).map(([id, l2]) => ({ ...l2, id: String(id) })).sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
  }
  function roomFighter(profile, data, crates) {
    const fighter = cloneProfile(profile);
    fighter.food = [];
    fighter.drinks = [];
    return { player: toDTO(fighter, data), extraBuffs: [...profile.extraBuffs || [], ...crateBuffs(data, crates)] };
  }
  var DAMAGE_TYPES = ["physical", "water", "nature", "fire"];
  var RESISTANCE_STAT = { physical: "armor", water: "waterResistance", nature: "natureResistance", fire: "fireResistance" };
  var ATTACK_STYLES = ["stab", "slash", "smash", "ranged", "magic"];
  var STYLE_TYPES = { stab: ["physical"], slash: ["physical"], smash: ["physical"], ranged: ["physical", "water", "fire"], magic: ["water", "nature", "fire"] };
  function damageTaken(data, monsterHrid, level) {
    const monster = data.combatMonsterDetailMap[monsterHrid];
    const stats = monster.combatDetails.combatStats || {};
    const scale = level / 100;
    const defense = 0.2 * (monster.combatDetails.defenseLevel || 0) * scale;
    const out = {};
    for (const type of DAMAGE_TYPES) {
      const resistance = (stats[RESISTANCE_STAT[type]] || 0) * scale + defense;
      out[type] = resistance >= 0 ? 100 / (100 + resistance) : (100 - resistance) / 100;
    }
    return out;
  }
  function evasionByStyle(data, monsterHrid) {
    const stats = data.combatMonsterDetailMap[monsterHrid].combatDetails.combatStats || {};
    return Object.fromEntries(ATTACK_STYLES.map((style) => [style, 1 + (stats[style + "Evasion"] || 0)]));
  }
  function hitScore(data, monsterHrid, style, type) {
    return damageTaken(data, monsterHrid, 100)[type] / evasionByStyle(data, monsterHrid)[style];
  }
  var THORNS_BELOW = 0.1;
  function weakTo(data, monsterHrid) {
    const pairs = [];
    for (const style of ATTACK_STYLES) for (const type of STYLE_TYPES[style]) pairs.push({ style, type, score: hitScore(data, monsterHrid, style, type) });
    const best = Math.max(...pairs.map((p2) => p2.score));
    const styles = [];
    for (const p2 of pairs.filter((p3) => p3.score >= best / 2).sort((a, b) => b.score - a.score)) {
      const known = styles.find((s2) => s2.style === p2.style);
      if (known) known.types.push(p2.type);
      else styles.push({ style: p2.style, types: [p2.type] });
    }
    return { styles, best, thorns: best < THORNS_BELOW };
  }
  function yourStyle(profile, data) {
    const weapon = weaponOf(profile);
    const first = weapon ? data.itemDetailMap[weapon.hrid]?.equipmentDetail?.combatStats?.combatStyleHrids?.[0] : null;
    return (first || "/combat_styles/smash").split("/").pop();
  }
  function yourAttacks(profile, data) {
    const weapon = weaponOf(profile);
    const out = [{ what: weapon?.hrid || "punch", style: yourStyle(profile, data), type: (weapon ? data.itemDetailMap[weapon.hrid]?.equipmentDetail?.combatStats?.damageType : "") || "/damage_types/physical" }];
    for (const entry of profile.abilities || []) {
      if (!entry) continue;
      for (const effect of data.abilityDetailMap[entry.hrid]?.abilityEffects || []) {
        if (effect.damageType && effect.combatStyleHrid) out.push({ what: entry.hrid, style: effect.combatStyleHrid, type: effect.damageType });
      }
    }
    return out.map((a) => ({ ...a, style: a.style.split("/").pop(), type: a.type.split("/").pop() })).filter((a) => ATTACK_STYLES.includes(a.style) && DAMAGE_TYPES.includes(a.type));
  }
  function yourMatch(profile, data, monsterHrid) {
    const weak = weakTo(data, monsterHrid);
    let best = null;
    for (const a of yourAttacks(profile, data)) {
      const score2 = hitScore(data, monsterHrid, a.style, a.type);
      if (!best || score2 > best.score) best = { ...a, score: score2 };
    }
    return best ? { ...best, share: best.score / weak.best } : null;
  }
  function monsterAttack(data, monsterHrid) {
    const stats = data.combatMonsterDetailMap[monsterHrid].combatDetails.combatStats || {};
    return { style: (stats.combatStyleHrids?.[0] || "").split("/").pop(), type: (stats.damageType || "").split("/").pop() };
  }
  function styleWeapon(profile, data, style) {
    const fits = (item) => item?.equipmentDetail && ["main_hand", "two_hand"].includes(item.equipmentDetail.type?.split("/").pop()) && item.equipmentDetail.combatStats?.combatStyleHrids?.[0] === "/combat_styles/" + style && meetsRequirements(profile, item.equipmentDetail.levelRequirements);
    const owned = profile.inventory.filter((i) => fits(data.itemDetailMap[i.hrid])).sort((a, b) => (data.itemDetailMap[b.hrid].itemLevel || 0) - (data.itemDetailMap[a.hrid].itemLevel || 0) || b.enhancementLevel - a.enhancementLevel)[0];
    let weapon = owned ? { hrid: owned.hrid, enhancementLevel: owned.enhancementLevel, cost: 0, owned: true } : null;
    if (!weapon) {
      for (const item of Object.values(data.itemDetailMap)) {
        if (!fits(item)) continue;
        const price = askPrice(item.hrid, 0);
        if (price !== null && (!weapon || price < weapon.cost)) weapon = { hrid: item.hrid, enhancementLevel: 0, cost: price, owned: false };
      }
    }
    if (weapon) weapon.slot = data.itemDetailMap[weapon.hrid].equipmentDetail.type.split("/").pop();
    return weapon;
  }
  var rate = (point) => point.attempts ? point.wins / point.attempts : 0;
  function pointsToJobs(fighter, points, rooms) {
    return points.map((p2, i) => ({ ...fighter, monsterHrid: p2.monster, roomLevel: p2.level, attempts: rooms, seed: seedFor2(p2.seed ?? i) }));
  }
  function summarizeCurve(curve) {
    let safe = null;
    for (const p2 of curve) {
      if (rate(p2) >= SAFE_WIN) safe = p2.level;
      else break;
    }
    let half = null;
    if (curve.length && rate(curve[0]) >= RISKY_WIN) {
      half = curve[curve.length - 1].level;
      for (let i = 1; i < curve.length; i++) {
        const a = curve[i - 1];
        const b = curve[i];
        if (rate(b) < RISKY_WIN) {
          const ra = rate(a);
          const rb = rate(b);
          half = a.level + (ra - RISKY_WIN) / Math.max(1e-9, ra - rb) * (b.level - a.level);
          break;
        }
      }
    }
    return { safe, half };
  }
  function winAt(curve, level) {
    if (!curve.length) return null;
    if (level <= curve[0].level) return rate(curve[0]);
    for (let i = 1; i < curve.length; i++) {
      const a = curve[i - 1];
      const b = curve[i];
      if (level <= b.level) return rate(a) + (level - a.level) / (b.level - a.level) * (rate(b) - rate(a));
    }
    return rate(curve[curve.length - 1]);
  }
  function nearestPoint(curve, level) {
    return curve.reduce((best, p2) => !best || Math.abs(p2.level - level) < Math.abs(best.level - level) ? p2 : best, null);
  }
  function better(a, b) {
    const key2 = (m2) => [m2.half ?? -1, m2.safe ?? -1, m2.curve.length ? rate(m2.curve[0]) : 0];
    const [x, y] = [key2(a), key2(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
  }
  async function simulateCurves(pool, fighter, monsters, rooms, onProgress) {
    const coarse = monsters.flatMap((monster) => COARSE_LEVELS.map((level, i) => ({ monster, level, seed: i })));
    const fine = [];
    let before = 0;
    const run = (points) => runCached(pool, pointsToJobs(fighter, points, rooms), (done2) => onProgress?.(before + done2, coarse.length + fine.length));
    const coarseResults = await run(coarse);
    before = coarse.length;
    const curves = new Map(monsters.map((m2) => [m2, []]));
    coarse.forEach((p2, i) => curves.get(p2.monster).push({ level: p2.level, ...coarseResults[i] }));
    for (const monster of monsters) {
      const curve = curves.get(monster);
      const lastSafe = [...curve].reverse().find((p2) => rate(p2) >= SAFE_WIN)?.level ?? 0;
      const firstLost = curve.find((p2) => p2.level > lastSafe && rate(p2) <= 0.1)?.level ?? MAX_LEVEL;
      const have6 = new Set(curve.map((p2) => p2.level));
      const levels = [];
      for (let level = Math.max(MIN_LEVEL, lastSafe) + FINE_STEP; level < firstLost && levels.length < MAX_FINE; level += FINE_STEP) {
        if (!have6.has(level)) levels.push(level);
      }
      fine.push(...levels.map((level) => ({ monster, level, seed: 100 + level })));
    }
    const fineResults = await run(fine);
    fine.forEach((p2, i) => curves.get(p2.monster).push({ level: p2.level, ...fineResults[i] }));
    return monsters.map((hrid) => {
      const curve = curves.get(hrid).sort((a, b) => a.level - b.level);
      return { hrid, curve, ...summarizeCurve(curve) };
    });
  }
  async function analyzeLabyrinth(pool, setups, data, settings2, character, onProgress) {
    const accuracy = LAB_ACCURACY[settings2.accuracy] || LAB_ACCURACY.normal;
    const crates = chosenCrates(settings2, character);
    const monsters = labyrinthMonsters(data);
    const results = [];
    for (const [i, setup] of setups.entries()) {
      const curves = await simulateCurves(
        pool,
        roomFighter(setup.profile, data, crates),
        monsters,
        accuracy.rooms,
        (done2, total) => onProgress?.(i * 1e3 + Math.round(1e3 * done2 / Math.max(1, total)), setups.length * 1e3)
      );
      results.push({ id: setup.id, name: setup.name, monsters: curves });
    }
    const best = monsters.map((hrid, m2) => {
      let pick2 = null;
      for (const setup of results) if (!pick2 || better(setup.monsters[m2], pick2.monster)) pick2 = { setup, monster: setup.monsters[m2] };
      return { ...pick2.monster, setupId: pick2.setup.id, setupName: pick2.setup.name };
    });
    return { crates, rooms: accuracy.rooms, setups: results, monsters: best };
  }
  var SKILL_STEP = 5;
  var ABILITY_STEP = 5;
  var SKILL_LABEL = { stamina: "Stamina", intelligence: "Intelligence", attack: "Attack", melee: "Melee", defense: "Defense", ranged: "Ranged", magic: "Magic" };
  function improvementCandidates(profile, data, crates) {
    const list = [];
    for (const kind of Object.keys(CRATE_KINDS)) {
      const now2 = CRATE_TIERS.indexOf(crates[kind]);
      for (const tier of CRATE_TIERS.slice(now2 + 1)) {
        list.push({ id: `crate:${kind}:${tier}`, kind: "crate", label: `${tier[0].toUpperCase() + tier.slice(1)} ${CRATE_KINDS[kind]}`, crates: { ...crates, [kind]: tier }, profile });
      }
    }
    for (const skill of Object.keys(SKILL_LABEL)) {
      const changed2 = cloneProfile(profile);
      changed2.levels[skill] += SKILL_STEP;
      list.push({ id: `skill:${skill}`, kind: "skill", label: `+${SKILL_STEP} ${SKILL_LABEL[skill]}`, crates, profile: changed2 });
    }
    profile.abilities.forEach((entry, slot) => {
      if (!entry) return;
      const changed2 = cloneProfile(profile);
      changed2.abilities[slot].level += ABILITY_STEP;
      list.push({ id: `ability:${entry.hrid}`, kind: "ability", hrid: entry.hrid, label: `+${ABILITY_STEP} levels ${data.abilityDetailMap[entry.hrid]?.name || entry.hrid}`, crates, profile: changed2 });
    });
    profile.abilities.forEach((entry, slot) => {
      if (!entry || slot === 0) return;
      const changed2 = cloneProfile(profile);
      changed2.abilities[slot] = null;
      list.push({ id: `drop:${entry.hrid}`, kind: "swap", hrid: null, replaces: entry.hrid, slot, label: `Without ${data.abilityDetailMap[entry.hrid]?.name || entry.hrid}`, crates, profile: changed2 });
    });
    const using = new Set(profile.abilities.filter(Boolean).map((a) => a.hrid));
    for (const [hrid, level] of Object.entries(profile.learnedAbilities || {})) {
      const detail = data.abilityDetailMap[hrid];
      if (!detail || detail.isSpecialAbility || using.has(hrid)) continue;
      for (let slot = 1; slot <= slotCounts(profile, data).abilities; slot++) {
        const old = profile.abilities[slot];
        const changed2 = cloneProfile(profile);
        changed2.abilities[slot] = { hrid, level };
        list.push({ id: `swap:${slot}:${hrid}`, kind: "swap", hrid, replaces: old?.hrid || null, slot, label: `${detail.name}${old ? ` instead of ${data.abilityDetailMap[old.hrid]?.name || old.hrid}` : " in an empty slot"}`, crates, profile: changed2 });
        if (!old) break;
      }
    }
    return list;
  }
  function edgeOf(m2, seed) {
    const level = Math.round(Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, m2.half ?? MIN_LEVEL)));
    const here = winAt(m2.curve, level);
    const below = [...m2.curve].reverse().find((p2) => p2.level <= level - 1 && rate(p2) > here) || m2.curve[0];
    const above = m2.curve.find((p2) => p2.level >= level + 1 && rate(p2) < here) || m2.curve[m2.curve.length - 1];
    const slope = above.level > below.level ? (rate(below) - rate(above)) / (above.level - below.level) : 0;
    return { hrid: m2.hrid, level, slope: Math.max(0.01, slope), seed };
  }
  var BASE_REPEAT = 4;
  async function atEdges(pool, data, setups, rooms, seedShift, onProgress) {
    const jobs = [];
    for (const setup of setups) {
      const fighter = roomFighter(setup.profile, data, setup.crates);
      for (let k = 0; k < (setup.repeat || 1); k++) {
        for (const edge of setup.edges) jobs.push({ ...fighter, monsterHrid: edge.hrid, roomLevel: edge.level, attempts: rooms, seed: seedFor2(edge.seed + seedShift + 7919 * k) });
      }
    }
    const results = await runCached(pool, jobs, onProgress);
    let next = 0;
    return setups.map((setup) => {
      const sums = setup.edges.map(() => ({ attempts: 0, wins: 0, deaths: 0, timeouts: 0 }));
      for (let k = 0; k < (setup.repeat || 1); k++) {
        sums.forEach((sum) => {
          const r = results[next++];
          for (const key2 of Object.keys(sum)) sum[key2] += r[key2];
        });
      }
      return sums;
    });
  }
  async function analyzeImprovements(pool, setups, data, settings2, lab, onProgress) {
    const accuracy = LAB_ACCURACY[settings2.accuracy] || LAB_ACCURACY.normal;
    const byId = new Map(setups.map((s2) => [s2.id, s2]));
    const groups = /* @__PURE__ */ new Map();
    lab.monsters.forEach((m2, i) => {
      const setup = byId.get(m2.setupId) || setups[0];
      if (!groups.has(setup.id)) groups.set(setup.id, { setup, edges: [], candidates: improvementCandidates(setup.profile, data, lab.crates) });
      groups.get(setup.id).edges.push(edgeOf(m2, 1e3 + i));
    });
    const runs = [];
    for (const group of groups.values()) {
      runs.push({ profile: group.setup.profile, crates: lab.crates, edges: group.edges, repeat: BASE_REPEAT });
      for (const c2 of group.candidates) runs.push({ profile: c2.profile, crates: c2.crates, edges: group.edges });
    }
    const results = await atEdges(pool, data, runs, accuracy.improveRooms, 0, onProgress);
    const combined = /* @__PURE__ */ new Map();
    const base = [];
    let r = 0;
    for (const group of groups.values()) {
      const own = results[r++];
      group.edges.forEach((edge, i) => base.push({ hrid: edge.hrid, level: edge.level, setupName: group.setup.name, win: rate(own[i]), deaths: own[i].deaths / own[i].attempts, timeouts: own[i].timeouts / own[i].attempts }));
      for (const c2 of group.candidates) {
        const theirs = results[r++];
        const id = c2.kind === "swap" ? `${group.setup.id}:${c2.id}` : c2.id;
        const { profile: _p, crates: _c, ...rest } = c2;
        if (!combined.has(id)) combined.set(id, { ...rest, setupName: group.setup.name, perMonster: [] });
        group.edges.forEach((edge, i) => {
          const gain = rate(theirs[i]) - rate(own[i]);
          combined.get(id).perMonster.push({ hrid: edge.hrid, level: edge.level, before: rate(own[i]), after: rate(theirs[i]), levels: Math.max(-50, Math.min(50, gain / edge.slope)) });
        });
      }
    }
    const candidates = [...combined.values()].map((c2) => ({ ...c2, levels: c2.perMonster.reduce((sum, m2) => sum + m2.levels, 0) / lab.monsters.length }));
    return { rooms: accuracy.improveRooms, base, candidates };
  }
  function monstersFor(data, style) {
    return labyrinthMonsters(data).filter((hrid) => weakTo(data, hrid).styles.some((s2) => s2.style === style));
  }
  var SCREEN_SHARE = 0.5;
  var PER_SLOT = 3;
  var ROUNDS2 = 6;
  var MIN_LEVELS = 0.5;
  var LEVELS_PER_MILLION = { frugal: 2, balanced: 0.5, all: 0 };
  var ROUND_ROOMS = 2;
  var CONFIRM_TRIES = 3;
  function applyCandidate(profile, c2) {
    const out = cloneProfile(profile);
    const index = c2.slot?.startsWith("ability") ? Number(c2.slot.replace("ability", "")) : null;
    if (c2.kind === "gear") equip(out, c2.slot, { hrid: c2.hrid, enhancementLevel: c2.enhancementLevel });
    else if (c2.kind === "ability" || c2.kind === "abilityLevel") out.abilities[index] = { hrid: c2.hrid, level: c2.level };
    else if (c2.kind === "drop") out.abilities[index] = null;
    else if (c2.kind === "dropAll") out.abilities = out.abilities.map((entry, i) => i === 0 ? entry : null);
    else if (c2.kind === "triggers") out.abilityTriggers = { ...out.abilityTriggers, ...Object.fromEntries(out.abilities.filter(Boolean).map((a) => [a.hrid, []])) };
    return out;
  }
  async function buildLoadout(pool, profile, data, settings2, opts, onProgress) {
    const accuracy = LAB_ACCURACY[settings2.accuracy] || LAB_ACCURACY.normal;
    const { style, crates } = opts;
    let budget = Math.max(0, Number(opts.budget) || 0);
    const minPerMillion = LEVELS_PER_MILLION[settings2.spending] ?? LEVELS_PER_MILLION.balanced;
    const targets = monstersFor(data, style);
    if (!targets.length) throw new Error(`No Labyrinth monster is weak to ${style}.`);
    let start2 = cloneProfile(profile);
    let starter = null;
    if (yourStyle(profile, data) !== style) {
      starter = styleWeapon(profile, data, style);
      if (!starter) throw new Error(`No ${style} weapon you can wear is for sale.`);
      starter.replaces = weaponOf(profile);
      equip(start2, starter.slot, { hrid: starter.hrid, enhancementLevel: starter.enhancementLevel });
      budget = Math.max(0, budget - starter.cost);
    }
    start2.food = [];
    start2.drinks = [];
    const steps = 14;
    const part2 = (from, size) => (done2, total) => onProgress?.(Math.round((from + size * done2 / Math.max(1, total)) * 1e3 / steps), 1e3);
    const before = await simulateCurves(pool, roomFighter(start2, data, crates), targets, accuracy.rooms, part2(0, 3));
    const edges = before.map((m2, i) => edgeOf(m2, 2e3 + i));
    const subStyle = (c2) => c2.kind !== "gear" || !["main_hand", "two_hand"].includes(c2.slot) || data.itemDetailMap[c2.hrid]?.equipmentDetail?.combatStats?.combatStyleHrids?.[0] === "/combat_styles/" + style;
    const candidates = [
      // A loadout of its own sells nothing: what it replaces is still worn in your other loadouts.
      ...gearCandidates(start2, { budget, starter, enhanceCost: opts.enhanceCost }).filter((c2) => c2.slot !== "pouch" && !c2.extraFood && subStyle(c2)).map((c2) => ({ ...c2, cost: c2.price ?? c2.cost, resale: 0, sold: [] })).filter((c2) => c2.cost <= budget),
      ...abilityCandidates(start2, budget)
    ];
    start2.abilities.forEach((entry, index) => {
      if (!entry || index === 0) return;
      const without = cloneProfile(start2);
      without.abilities[index] = null;
      candidates.push({ kind: "drop", slot: "ability" + index, hrid: entry.hrid, cost: 0, owned: true, profile: without });
    });
    if (start2.abilities.slice(1).filter(Boolean).length > 1) {
      const bare = cloneProfile(start2);
      bare.abilities = bare.abilities.map((entry, index) => index === 0 ? entry : null);
      candidates.push({ kind: "dropAll", slot: "abilities", cost: 0, owned: true, profile: bare });
    }
    const quiet = cloneProfile(start2);
    quiet.abilityTriggers = Object.fromEntries(start2.abilities.filter(Boolean).map((a) => [a.hrid, []]));
    candidates.push({ kind: "triggers", slot: "triggers", cost: 0, owned: true, profile: quiet });
    const scoreAt = (edgeList) => (own, base) => edgeList.reduce((sum, edge, i) => sum + Math.max(-50, Math.min(50, (rate(own[i]) - rate(base[i])) / edge.slope)), 0) / edgeList.length;
    const screenRooms = Math.max(20, Math.round(accuracy.improveRooms * SCREEN_SHARE));
    const first = await atEdges(pool, data, [{ profile: start2, crates, edges, repeat: BASE_REPEAT }, ...candidates.map((c2) => ({ profile: c2.profile, crates, edges }))], screenRooms, 0, part2(3, 5));
    candidates.forEach((c2, i) => c2.levels = scoreAt(edges)(first[i + 1], first[0]));
    const bySlot = /* @__PURE__ */ new Map();
    for (const c2 of candidates.filter((c3) => c3.cost > 0 && c3.levels > 0).sort((a, b) => b.levels - a.levels)) {
      const list = bySlot.get(c2.slot) || [];
      if (list.length < PER_SLOT) list.push(c2);
      bySlot.set(c2.slot, list);
    }
    const shortlist2 = [...candidates.filter((c2) => c2.cost === 0), ...[...bySlot.values()].flat()];
    const abilitySlots = [1, 2, 3, 4].map((i) => "ability" + i);
    const slotsOf2 = (c2) => c2.slot === "two_hand" ? ["two_hand", "main_hand", "off_hand"] : c2.slot === "main_hand" || c2.slot === "off_hand" ? [c2.slot, "two_hand"] : c2.kind === "dropAll" ? [...abilitySlots, "triggers", "abilities"] : c2.slot.startsWith("ability") && c2.slot !== "ability0" ? [c2.slot, "abilities"] : c2.slot === "triggers" ? ["triggers", "abilities"] : [c2.slot];
    const taken = /* @__PURE__ */ new Set();
    const picks = [];
    let left = budget;
    let built = start2;
    let now2 = before;
    let lastRound = [];
    for (let round = 0; round < ROUNDS2; round++) {
      const open2 = shortlist2.filter((c2) => !picks.includes(c2) && !slotsOf2(c2).some((x) => taken.has(x)) && c2.cost <= left);
      if (!open2.length) break;
      const roundEdges = now2.map((m2, i) => edgeOf(m2, 3e3 + 10 * round + i));
      const from = part2(8 + round, 1);
      const results = await atEdges(pool, data, [{ profile: built, crates, edges: roundEdges, repeat: BASE_REPEAT }, ...open2.map((c2) => ({ profile: applyCandidate(built, c2), crates, edges: roundEdges }))], ROUND_ROOMS * accuracy.improveRooms, 500 + round, from);
      open2.forEach((c2, i) => c2.roundLevels = scoreAt(roundEdges)(results[i + 1], results[0]));
      lastRound = open2;
      const dropOf = (c2) => c2.kind === "ability" && c2.replaces ? open2.find((d) => d.kind === "drop" && d.hrid === c2.replaces) : null;
      const beatsDrop = (c2) => !dropOf(c2) || c2.roundLevels >= dropOf(c2).roundLevels + MIN_LEVELS;
      const worth = (c2) => c2.roundLevels >= MIN_LEVELS && beatsDrop(c2) && (c2.cost === 0 || c2.roundLevels / (c2.cost / 1e6) >= minPerMillion);
      const good = open2.filter(worth);
      const order = [...good.filter((c2) => c2.cost === 0).sort((a, b) => b.roundLevels - a.roundLevels), ...good.filter((c2) => c2.cost > 0).sort((a, b) => b.roundLevels / b.cost - a.roundLevels / a.cost)];
      let pick2 = null;
      for (const [k, c2] of order.slice(0, CONFIRM_TRIES).entries()) {
        const check = await atEdges(pool, data, [{ profile: built, crates, edges: roundEdges, repeat: BASE_REPEAT }, { profile: applyCandidate(built, c2), crates, edges: roundEdges, repeat: ROUND_ROOMS }], accuracy.improveRooms, 900 + 10 * round + k);
        c2.roundLevels = (c2.roundLevels + scoreAt(roundEdges)(check[1], check[0])) / 2;
        if (worth(c2)) {
          pick2 = c2;
          break;
        }
      }
      if (!pick2) break;
      pick2.levels = pick2.roundLevels;
      picks.push(pick2);
      slotsOf2(pick2).forEach((x) => taken.add(x));
      left -= pick2.cost;
      built = applyCandidate(built, pick2);
      now2 = await simulateCurves(pool, roomFighter(built, data, crates), targets, accuracy.rooms, part2(8 + round, 1));
    }
    const after = now2;
    onProgress?.(1e3, 1e3);
    const strip = ({ profile: _p, ...rest }) => rest;
    return {
      style,
      targets,
      starter,
      budget: Number(opts.budget) || 0,
      spent: (starter && !starter.owned ? starter.cost : 0) + picks.reduce((sum, p2) => sum + p2.cost, 0),
      before,
      after,
      picks: picks.map(strip),
      // The best of the rest, for "also tested".
      // The best of the rest in the last round, measured from (nearly) the finished list.
      nearMisses: lastRound.filter((c2) => !picks.includes(c2) && c2.roundLevels > 0).sort((a, b) => b.roundLevels - a.roundLevels).slice(0, 6).map((c2) => ({ ...strip(c2), levels: c2.roundLevels })),
      tested: candidates.length,
      profile: built
    };
  }

  // src/labyrinth-skilling.js
  var ROOM_SECONDS = 120;
  var ACTION_SECONDS = 10;
  var ENHANCING_SECONDS = 8;
  var ENHANCING_TARGET = 5;
  var BUFF_MAPS2 = ["equipmentActionTypeBuffsMap", "houseActionTypeBuffsMap", "communityActionTypeBuffsMap", "achievementActionTypeBuffsMap", "mooPassActionTypeBuffsMap"];
  var GATHERING = ["milking", "foraging", "woodcutting"];
  var GOURMET = ["cooking", "brewing"];
  var amount = (b) => (Number(b.flatBoost) || 0) + (Number(b.flatBoostLevelBonus) || 0) + (Number(b.ratioBoost) || 0) + (Number(b.ratioBoostLevelBonus) || 0);
  function skillingBuffs(skill, buffs) {
    const out = { level: 0, efficiency: 0, speed: 0, success: 0, double: 0 };
    for (const b of buffs || []) {
      if (!b?.typeHrid) continue;
      const t4 = b.typeHrid;
      const x = amount(b);
      if (t4 === `/buff_types/${skill}_level`) out.level += x;
      else if (t4 === "/buff_types/efficiency") out.efficiency += x;
      else if (t4 === "/buff_types/action_speed") out.speed += x;
      else if (t4 === "/buff_types/labyrinth_double_progress") out.double += x;
      else if (t4 === "/buff_types/gathering" && GATHERING.includes(skill)) out.double += x;
      else if (t4 === "/buff_types/gourmet" && GOURMET.includes(skill)) out.double += x;
      else if (t4 === "/buff_types/success_rate" || t4 === `/buff_types/${skill}_success`) out.success += x;
    }
    return out;
  }
  function reachChance(tries, units, success, double, fallBack) {
    if (units <= 0) return 1;
    if (success <= 0 || units > tries * 2) return 0;
    const q0 = 1 - success;
    const q1 = success * (1 - double);
    const q2 = success * double;
    let dist = new Float64Array(units + 1);
    dist[0] = 1;
    for (let t4 = 0; t4 < tries; t4++) {
      const next = new Float64Array(units + 1);
      next[units] = dist[units];
      for (let u = 0; u < units; u++) {
        const p2 = dist[u];
        if (!p2) continue;
        next[fallBack ? Math.max(0, u - 1) : u] += p2 * q0;
        next[Math.min(units, u + 1)] += p2 * q1;
        next[Math.min(units, u + 2)] += p2 * q2;
      }
      dist = next;
    }
    return Math.min(1, Math.max(0, dist[units]));
  }
  function skillingRoomChance(room, who) {
    const b = { level: 0, efficiency: 0, speed: 0, success: 0, double: 0 };
    for (const list of [...who.buffs || [], who.crateBuffs || []]) {
      const x = skillingBuffs(room.skill, list);
      for (const k in b) b[k] += x[k];
    }
    const shop = who.shop || {};
    b.speed += 0.01 * (shop.speed || 0);
    b.efficiency += 0.01 * (shop.efficiency || 0);
    b.success += 5e-3 * (shop.success || 0);
    b.double += 0.01 * (shop.double || 0);
    const level = (who.level || 0) + b.level;
    const delta = level - room.level;
    const success = Math.min(1, Math.max(0, 0.8 * (1 + (delta >= 0 ? 5e-3 : 0.01) * delta + b.success)));
    const double = Math.min(1, Math.max(0, b.double));
    const enhancing = room.skill === "enhancing";
    const seconds = (enhancing ? ENHANCING_SECONDS : ACTION_SECONDS) / Math.max(0.05, 1 + b.speed);
    const tries = Math.max(1, Math.floor(ROOM_SECONDS / seconds));
    if (enhancing) return { chance: reachChance(tries, ENHANCING_TARGET, success, double, true), level, success, double, tries, needed: ENHANCING_TARGET };
    const perSuccess = Math.max(0, Math.floor(level * (1 + b.efficiency)));
    const needed = perSuccess > 0 ? Math.ceil(room.level * 10 / perSuccess - 1e-9) : Infinity;
    return { chance: Number.isFinite(needed) ? reachChance(tries, needed, success, double, false) : 0, level, success, double, tries, needed };
  }
  function skillingWho(character, data, skill, teaCrateHrid) {
    const actionType = `/action_types/${skill}`;
    const level = (character?.characterSkills || []).find((s2) => s2.skillHrid === `/skills/${skill}`)?.level || 1;
    const buffs = BUFF_MAPS2.map((key2) => character?.[key2]?.[actionType] || []);
    const crateBuffs2 = teaCrateHrid && data?.labyrinthCrateDetailMap?.[teaCrateHrid] || [];
    const info = character?.characterInfo || {};
    const shop = { speed: info.labyrinthSkillActionSpeedLevel, efficiency: info.labyrinthSkillingEfficiencyLevel, success: info.labyrinthSkillingSuccessLevel, double: info.labyrinthSkillingDoubleProgressLevel };
    return { level, buffs, crateBuffs: crateBuffs2, shop };
  }

  // src/labyrinth-marks.js
  var SCAN_MS8 = 400;
  var STORE = "mwia-laby-check";
  var TABLE = 'table[class*="LabyrinthPanel_automationTable"]';
  var LABEL2 = '[class*="LabyrinthPanel_roomLabel"]';
  var CHOSEN = 'input[class*="MuiSelect-nativeInput"], input[class*="nativeInput"]';
  var MARK = "mwia-laby-mark";
  var NOTE = "mwia-laby-note";
  var GRID = '[class*="LabyrinthPanel_roomGrid"]';
  var CELL = '[class*="LabyrinthPanel_roomCell"]';
  var CELL_MARK = "mwia-laby-cellmark";
  var m = { deps: null, scanTimer: null, stored: void 0 };
  var pct4 = (x) => `${Math.round(100 * x)}%`;
  function rememberLabyrinth(lab) {
    if (!lab) return;
    const kept2 = {
      at: Date.now(),
      monsters: lab.monsters.map((x) => ({ hrid: x.hrid, setupId: x.setupId, setupName: x.setupName, safe: x.safe, curve: x.curve.map((p2) => ({ level: p2.level, wins: p2.wins, attempts: p2.attempts })) }))
    };
    m.stored = kept2;
    try {
      localStorage.setItem(STORE, JSON.stringify(kept2));
    } catch {
    }
    scheduleScan8();
  }
  function lastCheck() {
    if (m.stored === void 0) {
      try {
        m.stored = JSON.parse(localStorage.getItem(STORE) || "null");
      } catch {
        m.stored = null;
      }
    }
    return m.stored;
  }
  function startLabyrinthMarks(deps) {
    m.deps = deps;
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(`.${MARK}, .${NOTE}, .${CELL_MARK}`))) return;
      scheduleScan8();
    }).observe(document.body, { childList: true, subtree: true });
    onStateChange(() => scheduleScan8());
    scheduleScan8();
  }
  function scheduleScan8() {
    if (m.scanTimer || !m.deps) return;
    m.scanTimer = setTimeout(() => {
      m.scanTimer = null;
      try {
        scan7();
      } catch (error) {
        console.warn("[MWI Advisor] labyrinth marks", error);
      }
    }, SCAN_MS8);
  }
  function rowMonster(row, monsters, data) {
    const label3 = row.querySelector(LABEL2) || row.querySelector("td");
    if (!label3) return null;
    const use = label3.querySelector("use");
    const icon = (use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").split("#")[1];
    const name = label3.textContent.replace(/\s+/g, " ").trim().toLowerCase();
    return monsters.find((x) => x.hrid === `/monsters/${icon}`) || monsters.find((x) => (data?.combatMonsterDetailMap?.[x.hrid]?.name || "").toLowerCase() === name) || null;
  }
  function markFor(monster, chosenId, level) {
    const win2 = winAt(monster.curve, level) ?? 0;
    const kind = win2 >= SAFE_WIN ? "ok" : win2 >= RISKY_WIN ? "warn" : "bad";
    const name = esc(monster.setupName);
    const saved = monster.setupId !== "equipped";
    const chosen = saved && String(chosenId) === String(monster.setupId);
    const floor = monster.safe === null ? "never safe" : floorAt(monster.safe) ? `safe to floor ${floorAt(monster.safe)}` : `safe to level ${Math.round(monster.safe)}`;
    let text;
    if (kind === "bad") text = `\u2716 Shroud or go around \xB7 best ${name}${chosen ? " (chosen)" : ""}: ${pct4(win2)}`;
    else if (!saved) text = `${kind === "ok" ? "\u2705" : "\u26A0"} What you wear now (${pct4(win2)}) \u2013 save it as a loadout to pick it`;
    else if (chosen) text = `${kind === "ok" ? "\u2705" : "\u26A0"} ${name} \xB7 ${pct4(win2)}`;
    else text = `\u{1F449} Pick ${name} \xB7 ${pct4(win2)}`;
    const title = `MWI Advisor: ${pct4(win2)} of the rooms won at room level ${level} with ${monster.setupName} (${floor})`;
    return { kind, chosen, text, title };
  }
  function runRooms(labyrinth = state.labyrinth) {
    if (!labyrinth?.isActive || !Array.isArray(labyrinth.roomData)) return [];
    const rooms = [];
    labyrinth.roomData.forEach((row, r) => (row || []).forEach((room, c2) => {
      if (room?.monsterHrid && room.recommendedLevel) rooms.push({ row: r, col: c2, hrid: room.monsterHrid, level: room.recommendedLevel, cleared: !!room.isCleared });
      else if (room?.skillHrid && room.recommendedLevel) rooms.push({ row: r, col: c2, skill: room.skillHrid.split("/").pop(), level: room.recommendedLevel, cleared: !!room.isCleared });
    }));
    return rooms;
  }
  function automationLevel() {
    const levels = runRooms().filter((x) => x.hrid).map((x) => x.level).sort((a, b) => a - b);
    if (levels.length) return { level: levels[Math.floor(levels.length / 2)], run: true };
    return { level: m.deps.level(), run: false };
  }
  function scan7() {
    mapMarks();
    const tables = [...document.querySelectorAll(TABLE)].filter(visible);
    const check = lastCheck();
    const { level, run } = automationLevel();
    for (const table of tables) {
      note(table, check, level, run);
      if (!check) continue;
      const data = getClientData();
      for (const row of table.querySelectorAll("tbody tr")) {
        const monster = rowMonster(row, check.monsters, data);
        if (!monster) continue;
        const cell = row.children[1] || row.lastElementChild;
        const chosenId = row.querySelector(CHOSEN)?.value ?? "";
        const mark3 = markFor(monster, chosenId, level);
        const cls = `${MARK} mwia-laby-${mark3.kind}${mark3.chosen ? "" : " mwia-laby-pick"}`;
        let el = cell.querySelector(`.${MARK}`);
        if (!el) {
          el = document.createElement("div");
          cell.appendChild(el);
        }
        if (el.className !== cls) el.className = cls;
        if (el.dataset.html !== mark3.text) el.innerHTML = el.dataset.html = mark3.text;
        if (el.title !== mark3.title) el.title = mark3.title;
      }
    }
  }
  function note(table, check, level, run) {
    let el = table.previousElementSibling?.classList?.contains(NOTE) ? table.previousElementSibling : null;
    if (!el) {
      el = document.createElement("div");
      el.className = NOTE;
      table.parentElement.insertBefore(el, table);
    }
    const floor = run ? ` (the rooms of floor ${state.labyrinth.currentFloor} you can see)` : floorAt(level) && floorLevel(floorAt(level)) === level ? ` (floor ${floorAt(level)}, roughly)` : "";
    const html = check ? `\u{1F9ED} MWI Advisor: the loadout to pick for each monster at room level ${level}${floor} \u2013 change it in \u{1F9ED} \u2192 Labyrinth. Checked ${new Date(check.at).toLocaleDateString()}; check again after changing gear.` : `\u{1F9ED} MWI Advisor: tap <b>Check the rooms</b> in \u{1F9ED} \u2192 Labyrinth, and each monster here gets the loadout to pick.`;
    if (el.dataset.html !== html) el.innerHTML = el.dataset.html = html;
  }
  function mapMarks() {
    const grid = [...document.querySelectorAll(GRID)].find(visible);
    const labyrinth = state.labyrinth;
    if (!grid || !labyrinth?.isActive) return;
    const cols = labyrinth.roomData?.[0]?.length || 0;
    const cells = [...grid.children].filter((el) => el.matches(CELL));
    if (!cols || cells.length !== cols * labyrinth.roomData.length) return;
    const check = lastCheck();
    const data = getClientData();
    const rooms = new Map(runRooms(labyrinth).map((x) => [x.row * cols + x.col, x]));
    if (!data && [...rooms.values()].some((x) => x.skill) && m.deps.prepare && !m.loading) {
      m.loading = m.deps.prepare().then(scheduleScan8, (error) => console.warn("[MWI Advisor] labyrinth marks", error)).finally(() => m.loading = null);
    }
    cells.forEach((cell, i) => {
      const room = rooms.get(i);
      let el = cell.querySelector(`.${CELL_MARK}`);
      const mark3 = room && !room.cleared ? room.skill ? skillingMark(room, labyrinth, data) : combatMark(room, check, data) : null;
      if (!mark3) {
        el?.remove();
        return;
      }
      const { win: win2, kind, title } = mark3;
      if (!el) {
        el = document.createElement("div");
        cell.appendChild(el);
      }
      const cls = `${CELL_MARK} mwia-laby-${kind}`;
      if (el.className !== cls) el.className = cls;
      const corner = `<span>${pct4(win2)}</span>`;
      if (el.dataset.html !== corner) {
        el.dataset.html = corner;
        el.innerHTML = corner;
      }
      if (el.title !== title) el.title = title;
    });
  }
  function verdict(win2) {
    return win2 >= SAFE_WIN ? "ok" : win2 >= RISKY_WIN ? "warn" : "bad";
  }
  function combatMark(room, check, data) {
    const monster = check?.monsters.find((x) => x.hrid === room.hrid);
    if (!monster) return null;
    const win2 = winAt(monster.curve, room.level) ?? 0;
    const kind = verdict(win2);
    const loadout = monster.setupId === "equipped" ? "what you wear now" : monster.setupName;
    const who = data?.combatMonsterDetailMap?.[room.hrid]?.name || room.hrid.split("/").pop();
    return { win: win2, kind, title: `MWI Advisor: Lv.${room.level} ${who} \u2013 ${kind === "bad" ? "shroud it or go around; best" : "take"} ${loadout}: ${pct4(win2)} won` };
  }
  function roomPrediction(room, labyrinth) {
    if (room.skillHrid) {
      const data = getClientData();
      if (!state.character || !data) return null;
      const r = skillingRoomChance({ skill: room.skillHrid.split("/").pop(), level: room.recommendedLevel }, skillingWho(state.character, data, room.skillHrid.split("/").pop(), labyrinth.teaCrateItemHrid));
      return { win: Math.round(1e3 * r.chance) / 1e3, how: "formula", success: Math.round(1e3 * r.success) / 1e3, tries: r.tries, needed: Number.isFinite(r.needed) ? r.needed : null };
    }
    const check = lastCheck();
    const monster = check?.monsters.find((x) => x.hrid === room.monsterHrid);
    if (!monster) return null;
    return { win: Math.round(1e3 * (winAt(monster.curve, room.recommendedLevel) ?? 0)) / 1e3, how: "check", best: monster.setupId, bestName: monster.setupName, checkedAt: check.at };
  }
  function skillingMark(room, labyrinth, data) {
    if (!state.character || !data) return null;
    const result = skillingRoomChance({ skill: room.skill, level: room.level }, skillingWho(state.character, data, room.skill, labyrinth.teaCrateItemHrid));
    const win2 = result.chance;
    const kind = verdict(win2);
    const skill = room.skill.charAt(0).toUpperCase() + room.skill.slice(1);
    const how = room.skill === "enhancing" ? `+${result.needed} in ${result.tries} tries` : `${result.needed} successes needed in ${result.tries} tries`;
    return { win: win2, kind, title: `MWI Advisor: Lv.${room.level} ${skill} \u2013 ${pct4(win2)} to clear (your level ${Math.round(result.level)}, ${pct4(result.success)} a try, ${how})` };
  }

  // src/enhance-plan.js
  var TYPE3 = "/action_types/enhancing";
  var COIN8 = "/items/coin";
  var TYPICAL = 0.5;
  var UNLUCKY = 0.9;
  var MIN_RUNS = 500;
  var MAX_RUNS = 4e3;
  var STEP_BUDGET = 1e7;
  var MAX_MEAN = 1e5;
  var NO_XP2 = new Array(MAX_TARGET + 2).fill(0);
  function seededRandom(seed) {
    let s2 = seed >>> 0 || 1;
    return () => {
      s2 = s2 + 1831565813 >>> 0;
      let t4 = s2;
      t4 = Math.imul(t4 ^ t4 >>> 15, t4 | 1);
      t4 ^= t4 + Math.imul(t4 ^ t4 >>> 7, t4 | 61);
      return ((t4 ^ t4 >>> 14) >>> 0) / 4294967296;
    };
  }
  function simulateTries(p2, blessed, start2, targets, from, runs, random) {
    const top = Math.max(...targets);
    const out = Object.fromEntries(targets.map((t4) => [t4, { attempts: new Float64Array(runs), protections: new Float64Array(runs) }]));
    const cap3 = 50 * MAX_MEAN;
    for (let r = 0; r < runs; r++) {
      let level = start2;
      let a = 0;
      let g4 = 0;
      let next = 0;
      while (level < top && a < cap3) {
        a++;
        if (random() < p2[level]) level += blessed > 0 && random() < blessed ? 2 : 1;
        else if (level >= from) {
          g4++;
          level--;
        } else level = 0;
        while (next < targets.length && level >= targets[next]) {
          out[targets[next]].attempts[r] = a;
          out[targets[next]].protections[r] = g4;
          next++;
        }
      }
      for (; next < targets.length; next++) {
        out[targets[next]].attempts[r] = a;
        out[targets[next]].protections[r] = g4;
      }
    }
    return out;
  }
  function quantile2(values, q) {
    const sorted = Float64Array.from(values).sort();
    if (!sorted.length) return null;
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
  }
  function enhancePlan({ itemHrid, start: start2 = 0, who, data, market, seed = 1 }) {
    const detail = data.itemDetailMap[itemHrid];
    const inputs = detail?.enhancementCosts?.length ? materials(detail, market) : null;
    if (!inputs || start2 >= MAX_TARGET) return null;
    const teas = who.drinks?.[TYPE3] || [];
    const { rates, blessed, cycleSeconds, effectiveLevel, multiplier } = enhanceRates(who, data, teas, detail.itemLevel || 1);
    const drinksPerAttempt = 12 * (who.concentration || 1) * cycleSeconds / 3600;
    const teaList = teas.map((hrid) => ({ itemHrid: hrid, count: drinksPerAttempt, price: market.buy(hrid) ?? 0, tea: true }));
    const perAttempt = [...inputs.map((i) => ({ itemHrid: i.itemHrid, count: i.count, price: i.price })), ...teaList];
    const attemptCost = perAttempt.reduce((sum, i) => sum + i.count * i.price, 0);
    const guard = cheapestProtection(detail, market);
    const meanCost = (cycle, guarded) => cycle.attempts * attemptCost + (guarded ? cycle.protections * guard.price : 0);
    const picks = [];
    for (let target = start2 + 1; target <= MAX_TARGET; target++) {
      const bare = protectedCycle(rates, blessed, target, target, NO_XP2, start2);
      let best = bare && Number.isFinite(bare.attempts) ? { from: target, cycle: bare, cost: meanCost(bare, false) } : null;
      for (let from = MIN_PROTECT; guard && from < target; from++) {
        const cycle = protectedCycle(rates, blessed, target, from, NO_XP2, start2);
        if (!cycle || !Number.isFinite(cycle.attempts)) continue;
        const cost = meanCost(cycle, true);
        if (!best || cost < best.cost) best = { from, cycle, cost };
      }
      if (!best) break;
      picks.push({ target, bare, ...best, guarded: best.from < target });
    }
    const spread = /* @__PURE__ */ new Map();
    const groups = /* @__PURE__ */ new Map();
    for (const pick2 of picks) {
      if (pick2.cycle.attempts > MAX_MEAN) continue;
      const key2 = pick2.guarded ? pick2.from : "none";
      if (!groups.has(key2)) groups.set(key2, []);
      groups.get(key2).push(pick2);
    }
    for (const [key2, list] of groups) {
      const from = key2 === "none" ? MAX_TARGET + 1 : key2;
      const most = Math.max(...list.map((pick2) => pick2.cycle.attempts));
      const runs = Math.round(Math.min(MAX_RUNS, Math.max(MIN_RUNS, STEP_BUDGET / Math.max(1, most))));
      const tries = simulateTries(rates, blessed, start2, list.map((pick2) => pick2.target), from, runs, seededRandom(seed * 7919 + (key2 === "none" ? 0 : key2)));
      for (const pick2 of list) {
        const { attempts, protections } = tries[pick2.target];
        const costs = attempts.map((a, i) => a * attemptCost + (pick2.guarded ? protections[i] * guard.price : 0));
        const at2 = (q) => {
          const n5 = quantile2(attempts, q);
          return { attempts: n5, protections: pick2.guarded ? quantile2(protections, q) : 0, cost: quantile2(costs, q), hours: n5 * cycleSeconds / 3600 };
        };
        spread.set(pick2.target, { typical: at2(TYPICAL), unlucky: at2(UNLUCKY), runs });
      }
    }
    const targets = picks.map(({ target, bare, from, cycle, cost, guarded }) => {
      const s2 = spread.get(target);
      return {
        target,
        protect: guarded ? { ...guard, from } : null,
        mean: { attempts: cycle.attempts, protections: guarded ? cycle.protections : 0, cost, hours: cycle.attempts * cycleSeconds / 3600 },
        typical: s2?.typical || null,
        unlucky: s2?.unlucky || null,
        runs: s2?.runs || 0,
        without: guarded && bare && Number.isFinite(bare.attempts) ? { cost: meanCost(bare, false), attempts: bare.attempts } : null
      };
    });
    return { itemHrid, start: start2, teas, rates, blessed, multiplier, effectiveLevel, cycleSeconds, attemptCost, perAttempt, guard, targets };
  }
  function withStock(plan, have6) {
    const owned = (hrid) => Math.max(0, (have6(hrid) || 0) - (hrid === plan.itemHrid && plan.start === 0 ? 1 : 0));
    const coins10 = have6(COIN8) || 0;
    const needs = (t4, outcome) => {
      if (!outcome) return null;
      const list = plan.perAttempt.map((i) => ({ itemHrid: i.itemHrid, price: i.price, tea: !!i.tea, count: Math.ceil(i.count * outcome.attempts) }));
      if (t4.protect) list.push({ itemHrid: t4.protect.itemHrid, price: t4.protect.price, protection: true, count: Math.ceil(outcome.protections) });
      for (const n5 of list) {
        n5.have = n5.itemHrid === COIN8 ? coins10 : owned(n5.itemHrid);
        n5.short = Math.max(0, n5.count - n5.have);
      }
      const coinsNeeded = list.reduce((sum, n5) => sum + (n5.itemHrid === COIN8 ? n5.count : n5.short * n5.price), 0);
      return { ...outcome, list, coinsNeeded, affordable: coinsNeeded <= coins10 };
    };
    const targets = plan.targets.map((t4) => ({ ...t4, mean: needs(t4, t4.mean), typical: needs(t4, t4.typical), unlucky: needs(t4, t4.unlucky) }));
    const reach = (pick2) => targets.reduce((top, t4) => pick2(t4)?.affordable ? t4.target : top, null);
    return { ...plan, coins: coins10, targets, reach: { typical: reach((t4) => t4.typical || t4.mean), unlucky: reach((t4) => t4.unlucky) } };
  }

  // src/enhance-plan-ui.js
  var SCAN_MS9 = 400;
  var TYPE4 = "/action_types/enhancing";
  var SKILL3 = "/skills/enhancing";
  var COIN9 = "/items/coin";
  var SHOWN = 5;
  var PAST_REACH = 3;
  var e = { deps: null, scanTimer: null, loading: null, plans: /* @__PURE__ */ new Map(), busy: null, open: /* @__PURE__ */ new Set(), statuses: /* @__PURE__ */ new Map(), panels: /* @__PURE__ */ new Map() };
  var coins6 = (n5) => shortCoins(Math.round(n5));
  var count2 = (n5) => Math.round(n5).toLocaleString("en-US");
  var have5 = (hrid) => state.character ? heldStock(state.character, state.items, hrid).inventory : 0;
  function duration2(hours) {
    const s2 = hours * 3600;
    if (s2 < 90) return `${Math.max(1, Math.round(s2))} s`;
    if (s2 < 90 * 60) return `${Math.round(s2 / 60)} min`;
    if (hours < 48) return `${hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)} h`;
    return `${Math.round(hours / 24 * 10) / 10} d`;
  }
  function startEnhancePlan(deps) {
    e.deps = deps;
    onStateChange(() => scheduleScan9());
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(".mwia-plan-box"))) return;
      scheduleScan9();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick6, true);
    document.addEventListener("toggle", onToggle, true);
  }
  function scheduleScan9() {
    if (e.scanTimer) return;
    e.scanTimer = setTimeout(() => {
      e.scanTimer = null;
      try {
        scan8();
      } catch (error) {
        console.warn("[MWI Advisor] enhancing plan", error);
      }
    }, SCAN_MS9);
  }
  function planInputs(itemHrid, start2) {
    const data = getClientData();
    const who = skillingCharacter(state.character, state.items, data);
    const key2 = JSON.stringify([pricesStamp(), who.levels[SKILL3], who.drinks[TYPE4], who.concentration, who.equipped, who.houseLevels, who.buffs?.[TYPE4] || null]);
    return { id: `${itemHrid}+${start2}`, key: key2, who, data };
  }
  function scan8() {
    const panels = levelingPanels().filter((p2) => p2.kind === "enhancing" && itemOfHash(p2.itemHash));
    if (panels.length && (!getClientData() || !pricesStamp())) {
      e.loading || (e.loading = e.deps.prepare().then(scheduleScan9, (error) => console.warn("[MWI Advisor] enhancing plan", error)).finally(() => e.loading = null));
      return;
    }
    const shown = /* @__PURE__ */ new Set();
    e.panels.clear();
    if (state.character) {
      for (const { panel, itemHash } of panels) {
        const itemHrid = itemOfHash(itemHash);
        const start2 = levelOfHash(itemHash) || 0;
        const { id, key: key2 } = planInputs(itemHrid, start2);
        e.panels.set(id, { panel, itemHash });
        shown.add(placeBox2(panel, id, boxHtml3(itemHrid, start2, id, key2)));
      }
    }
    document.querySelectorAll(".mwia-plan-box").forEach((box) => shown.has(box) || box.remove());
  }
  function placeBox2(panel, id, html) {
    let box = panel.nextElementSibling?.classList.contains("mwia-plan-box") ? panel.nextElementSibling : null;
    if (!box) {
      box = document.createElement("div");
      box.className = "mwia-plan-box";
      panel.insertAdjacentElement("afterend", box);
    }
    if (box.dataset.plan !== id || box.dataset.html !== html) {
      box.dataset.plan = id;
      box.dataset.html = html;
      box.innerHTML = html;
    }
    return box;
  }
  var head3 = (title, note2) => `<div class="mwia-guide-head"><b>${title}</b> <span>${note2}</span></div>`;
  function boxHtml3(itemHrid, start2, id, key2) {
    const status2 = e.statuses.get(id);
    const statusHtml3 = status2 ? `<div class="mwia-guide-status">${esc(status2)}</div>` : "";
    const title = head3("\u{1F3AF} Enhancing plan", `MWI Advisor \xB7 ${esc(itemName(itemHrid))}${start2 ? ` +${start2}` : ""}`);
    if (start2 >= 20) return title + `<div class="mwia-guide-note">Already at +20.</div>`;
    const saved = e.plans.get(id);
    const button2 = (label3) => `<button class="mwia-guide-cart mwia-plan-run" data-plan-run="${esc(id)}" ${e.busy ? "disabled" : ""}>${label3}</button>`;
    if (e.busy === id) return title + `<div class="mwia-guide-note mwia-plan-busy">\u{1F3B2} Simulating thousands of tries from +${start2} to every target\u2026 this can take a few seconds.</div>`;
    if (!saved) {
      return title + `<div class="mwia-guide-note">What reaching each +level typically costs and takes, with bad luck, which protection is worth it and the materials against what you have \u2013 simulated with your odds here (it can take a few seconds).</div>` + button2(`\u{1F3B2} Simulate +${start2 + 1} \u2026 +20`) + statusHtml3;
    }
    if (!saved.plan) return title + `<div class="mwia-guide-note">Can't plan this item: it has no enhancing materials, or one of them isn't for sale.</div>` + statusHtml3;
    const plan = withStock(saved.plan, have5);
    const stale2 = saved.key !== key2 ? `<div class="mwia-guide-note mwia-guide-low">Prices, your teas or your Enhancing have changed since. ${button2("\u{1F3B2} Simulate again")}</div>` : "";
    return title + stale2 + summaryHtml(plan) + tableHtml(plan, id) + statusHtml3;
  }
  function summaryHtml(plan) {
    const odds = [];
    plan.rates.forEach((r, L2) => {
      if (L2 >= plan.start && (L2 === plan.start || Math.abs(r - plan.rates[L2 - 1]) > 1e-9)) odds.push(`+${L2} ${(r * 100).toFixed(1)}%`);
    });
    const teas = plan.teas.length ? plan.teas.map(itemName).join(", ") : "no teas";
    const reach = (t4) => t4 === null ? "not even the next level" : `<b>+${t4}</b>`;
    return `<div class="mwia-guide-note">Success per attempt: ${odds.join(" \xB7 ")}${plan.blessed > 0 ? ` \xB7 ${(plan.blessed * 100).toFixed(1)}% of successes go up two` : ""}. ${plan.cycleSeconds.toFixed(2)} s and ${coins6(plan.attemptCost)} an attempt (${esc(teas)}; everything at the ask).</div><div class="mwia-guide-note">With your ${coins6(plan.coins)} coins and what you have: ${reach(plan.reach.typical)} typically, ${reach(plan.reach.unlucky)} even with bad luck.</div>`;
  }
  function tableHtml(plan, id) {
    const top = Math.max(plan.start + SHOWN, (plan.reach.typical ?? plan.start) + PAST_REACH);
    const rows = plan.targets.map((t4) => rowHtml3(plan, t4, id));
    const first = plan.targets.filter((t4) => t4.target <= top).length;
    const header = `<div class="mwia-plan-grid mwia-plan-header"><span>Target</span><span>Protect</span><span>Typical</span><span>Bad luck</span><span>Time</span></div>`;
    const more = rows.length > first ? `<details class="mwia-plan-more" data-plan-toggle="${esc(id)}:more"${e.open.has(`${id}:more`) ? " open" : ""}><summary>Higher targets (+${plan.targets[first].target} \u2026 +${plan.targets[rows.length - 1].target})</summary>${rows.slice(first).join("")}</details>` : "";
    return `<div class="mwia-plan-table">${header}${rows.slice(0, first).join("")}${more}</div><div class="mwia-guide-dim">Typical: half the time it costs less (the median). Bad luck: 9 times in 10 it costs less. Tap a row for the materials and to set it.</div>`;
  }
  function rowHtml3(plan, t4, id) {
    const toggle = `${id}:${t4.target}`;
    const sim = t4.typical;
    const cls = [sim ? "" : "mwia-plan-avg", (sim || t4.mean).affordable ? "" : "mwia-plan-dear", t4.target === plan.reach.typical ? "mwia-plan-reach" : ""].filter(Boolean).join(" ");
    const cells = [
      `<b>+${t4.target}</b>`,
      t4.protect ? `\u{1F6E1} +${t4.protect.from}` : "\u2013",
      sim ? coins6(sim.cost) : `\u2248${coins6(t4.mean.cost)}`,
      t4.unlucky ? coins6(t4.unlucky.cost) : "\u2013",
      duration2((sim || t4.mean).hours)
    ];
    return `<details class="mwia-plan-row ${cls}" data-plan-toggle="${esc(toggle)}"${e.open.has(toggle) ? " open" : ""}><summary class="mwia-plan-grid">${cells.map((c2) => `<span>${c2}</span>`).join("")}</summary>${detailHtml2(plan, t4)}</details>`;
  }
  function detailHtml2(plan, t4) {
    const lines = [];
    if (t4.protect) {
      const saves = t4.without ? ` On average ${coins6(t4.mean.cost)} with it against ${coins6(t4.without.cost)} without.` : "";
      lines.push(`\u{1F6E1} Protect from +${t4.protect.from} with ${esc(itemName(t4.protect.itemHrid))} (${coins6(t4.protect.price)}): a failure from +${t4.protect.from} on drops one level and uses one up; below it the item goes back to +0.${saves}`);
    } else lines.push(`No protection: it costs more than it saves for +${t4.target}. A failure drops the item to +0.`);
    const sim = t4.typical;
    if (sim) lines.push(`Typically ${count2(sim.attempts)} attempts (${duration2(sim.hours)}), with bad luck ${count2(t4.unlucky.attempts)} (${duration2(t4.unlucky.hours)}); on average ${count2(t4.mean.attempts)} attempts for ${coins6(t4.mean.cost)}.`);
    else lines.push(`Too many attempts to simulate: on average ${count2(t4.mean.attempts)} attempts (${duration2(t4.mean.hours)}), ${coins6(t4.mean.cost)}.`);
    const base = sim || t4.mean;
    const bad = t4.unlucky;
    const items = base.list.map((n5, i) => {
      const b = bad?.list[i];
      const amount2 = `${count2(n5.count)}${b ? ` (bad luck ${count2(b.count)})` : ""}`;
      const verdict3 = n5.short > 0 ? `<b class="mwia-guide-low">${count2(n5.short)} short</b>` : b?.short > 0 ? `enough typically, ${count2(b.short)} short with bad luck` : `<span class="mwia-ok">\u2713 ${count2(n5.have - (b || n5).count)} to spare</span>`;
      return `<li>${esc(n5.itemHrid === COIN9 ? "Coins" : itemName(n5.itemHrid))}${n5.protection ? " (protection)" : ""}${n5.tea ? " (tea)" : ""}: ${amount2} \xB7 have ${count2(n5.have)} \xB7 ${verdict3}</li>`;
    });
    const cart = (outcome, label3) => {
      const list = outcome ? outcome.list.filter((n5) => n5.itemHrid !== COIN9 && n5.short > 0).map((n5) => ({ hrid: n5.itemHrid, quantity: n5.short })) : [];
      return list.length ? `<button class="mwia-guide-cart" data-plan-cart="${esc(JSON.stringify(list))}" title="Adds to the MWITools cart: ${esc(list.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", "))}">${label3}</button>` : "";
    };
    const protectHave = t4.protect ? base.list.find((n5) => n5.protection)?.have || 0 : 0;
    const set = `<button class="mwia-guide-cart" data-plan-set="${t4.target}"${t4.protect && protectHave > 0 ? ` data-protect="${esc(t4.protect.itemHrid)}" data-from="${t4.protect.from}"` : ""}>\u25B6 Set +${t4.target}${t4.protect ? protectHave > 0 ? ` and protection from +${t4.protect.from}` : "" : ""}</button>`;
    return lines.map((l2) => `<div class="mwia-guide-note">${l2}</div>`).join("") + `<ul class="mwia-guide-list">${items.join("")}</ul><div class="mwia-plan-buttons">${set}${cart(sim ? sim : t4.mean, sim ? "\u{1F6D2} What's short (typical)" : "\u{1F6D2} What's short (average)")}${cart(bad, "\u{1F6D2} What's short (bad luck)")}</div>` + (t4.protect && protectHave <= 0 ? `<div class="mwia-guide-dim">Buy the protection first, then \u25B6 puts it in too.</div>` : "");
  }
  function runPlan(id) {
    const [itemHrid, startText] = [id.slice(0, id.lastIndexOf("+")), id.slice(id.lastIndexOf("+") + 1)];
    const start2 = Number(startText) || 0;
    e.busy = id;
    e.statuses.delete(id);
    scheduleScan9();
    setTimeout(() => {
      try {
        const { key: key2, who, data } = planInputs(itemHrid, start2);
        e.plans.set(id, { key: key2, plan: enhancePlan({ itemHrid, start: start2, who, data, market: skillingMarket("bid") }) });
      } catch (error) {
        console.warn("[MWI Advisor] enhancing plan", error);
        e.statuses.set(id, `Could not simulate: ${error.message}`);
      }
      e.busy = null;
      scheduleScan9();
    }, SCAN_MS9 + 150);
  }
  async function setTarget(button2, id) {
    const target = Number(button2.dataset.planSet);
    const where = e.panels.get(id);
    const characterId4 = state.character?.character?.id;
    const protectHrid = button2.dataset.protect;
    const protect = protectHrid && characterId4 ? { hash: inventoryItemHash(characterId4, protectHrid), from: Number(button2.dataset.from) } : null;
    const result = where ? await setEnhancing(where.panel, target, protect) : false;
    e.statuses.set(
      id,
      result === "item" ? `Target +${target} set${protect ? `, protection from +${protect.from}` : ""} \u2013 press the game's Enhance.` : result === "partial" ? `Target +${target} set, but put in ${itemName(protectHrid)} from +${button2.dataset.from} yourself (${navDiagnostics()}).` : `Could not set it: enter +${target} yourself (${navDiagnostics() || "no Enhancing window"}).`
    );
    scheduleScan9();
  }
  async function onClick6(event) {
    const button2 = event.target.closest?.(".mwia-plan-box button");
    if (!button2) return;
    event.preventDefault();
    event.stopPropagation();
    const id = button2.closest(".mwia-plan-box").dataset.plan;
    if (button2.dataset.planRun) return runPlan(button2.dataset.planRun);
    if (button2.dataset.planSet) return setTarget(button2, id);
    if (button2.dataset.planCart) {
      const names2 = (list) => list.map((i) => itemName(i.hrid)).join(", ");
      try {
        const outcome = await e.deps.addToCart(JSON.parse(button2.dataset.planCart));
        const parts = [];
        if (outcome.added.length) parts.push(`added ${names2(outcome.added)}`);
        if (outcome.updated.length) parts.push(`topped up ${names2(outcome.updated)}`);
        if (outcome.present.length) parts.push(`${names2(outcome.present)} already in the cart`);
        if (outcome.failed.length) parts.push(`could not add ${names2(outcome.failed)}`);
        e.statuses.set(id, "Cart: " + parts.join("; ") + ".");
      } catch (error) {
        e.statuses.set(id, error.message);
      }
      scheduleScan9();
    }
  }
  function onToggle(event) {
    const el = event.target;
    const key2 = el?.closest?.(".mwia-plan-box") && el.dataset?.planToggle;
    if (!key2) return;
    if (el.open) e.open.add(key2);
    else e.open.delete(key2);
  }

  // src/touch.js
  var isTouch = () => !!window.matchMedia?.("(hover: none)").matches;
  var isNarrow = () => !!window.matchMedia?.(NARROW).matches;
  var POSITION_KEY = "mwia-launcher-pos";
  var DRAG_THRESHOLD = 8;
  var tip = null;
  var hidingTips = false;
  function hideTip() {
    tip?.remove();
    tip = null;
  }
  function showTip(anchor, text) {
    hideTip();
    tip = document.createElement("div");
    tip.className = "mwia-tip-pop";
    tip.textContent = text;
    document.body.appendChild(tip);
    const box = anchor.getBoundingClientRect();
    const left = Math.min(Math.max(8, box.left + box.width / 2 - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - 8);
    const below = box.bottom + 6;
    const top = below + tip.offsetHeight < innerHeight - 8 ? below : Math.max(8, box.top - tip.offsetHeight - 6);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  function enableTapTips(root) {
    if (!hidingTips) {
      hidingTips = true;
      document.addEventListener("pointerdown", hideTip, true);
      document.addEventListener("scroll", hideTip, true);
    }
    root.addEventListener("click", (event) => {
      if (!isTouch() || event.target.closest("button, select, input, textarea, a")) return;
      const owner = event.target.closest("[title]");
      if (owner && root.contains(owner) && owner.title) showTip(owner, owner.title);
    });
  }
  function makeDraggable(button2, key2 = POSITION_KEY) {
    let start2 = null;
    let moved = false;
    const place2 = (x, y) => {
      button2.style.left = `${Math.min(Math.max(4, x), innerWidth - button2.offsetWidth - 4)}px`;
      button2.style.top = `${Math.min(Math.max(4, y), innerHeight - button2.offsetHeight - 4)}px`;
      button2.style.right = "auto";
      button2.style.bottom = "auto";
    };
    const placeSaved = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(key2) || "null");
        if (saved) place2(saved.x * innerWidth, saved.y * innerHeight);
      } catch {
      }
    };
    const save5 = () => {
      const box = button2.getBoundingClientRect();
      try {
        localStorage.setItem(key2, JSON.stringify({ x: box.left / innerWidth, y: box.top / innerHeight }));
      } catch {
      }
    };
    button2.addEventListener("pointerdown", (event) => {
      if (event.button) return;
      const box = button2.getBoundingClientRect();
      start2 = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
      moved = false;
      button2.setPointerCapture?.(event.pointerId);
    });
    button2.addEventListener("pointermove", (event) => {
      if (!start2) return;
      const dx = event.clientX - start2.x;
      const dy = event.clientY - start2.y;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      place2(start2.left + dx, start2.top + dy);
    });
    const end = () => {
      if (start2 && moved) save5();
      start2 = null;
    };
    button2.addEventListener("pointerup", end);
    button2.addEventListener("pointercancel", end);
    button2.addEventListener(
      "click",
      (event) => {
        if (!moved) return;
        moved = false;
        event.stopImmediatePropagation();
        event.preventDefault();
      },
      true
    );
    window.addEventListener("resize", placeSaved);
    requestAnimationFrame(placeSaved);
  }
  var TITLE_COLUMNS = /* @__PURE__ */ new Set(["Zone", "Item", "Ability", "Food", "Drink"]);
  function labelTableCells(container) {
    for (const table of container.querySelectorAll(".mwia-wide")) {
      const headers = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
      for (const row of table.querySelectorAll("tbody tr")) {
        [...row.cells].forEach((cell, i) => {
          cell.dataset.label = headers[i] || "";
          if (TITLE_COLUMNS.has(headers[i])) cell.classList.add("mwia-card-title");
        });
      }
    }
  }

  // src/plan-train.js
  var INVENTORY6 = "/item_locations/inventory";
  var PRODUCE = /* @__PURE__ */ new Set(["chain", "single", "mixed"]);
  function itemFromIcon(element) {
    for (const use of element?.querySelectorAll("use") || []) {
      const href = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
      const bare = href.split("#")[1];
      if (bare) return "/items/" + bare;
    }
    return null;
  }
  function activePolicy(element) {
    if (!element) return null;
    if (element.querySelector(".planning-policy-mixed")) return "mixed";
    const active = element.querySelector('.planning-policy-switch button[aria-pressed="true"], .planning-policy-switch button[data-active="true"]');
    return active?.dataset.policy || null;
  }
  function readPlanningTab(doc, data) {
    const byName = new Map(Object.values(data.itemDetailMap).map((item) => [item.name, item.hrid]));
    const goals = [];
    for (const row of doc.querySelectorAll(".planning-goal")) {
      const enabled = row.querySelector('input[type="checkbox"]')?.checked !== false;
      const id = row.querySelector(".planning-goal-current")?.dataset.goalId || "";
      const match = id.match(/^(house|item):(.+)$/);
      const target = Math.floor(Number(row.querySelector('input[type="number"]')?.value));
      if (!enabled || !match || !(target > 0)) continue;
      goals.push({ kind: match[1], hrid: match[2], target });
    }
    const policies = /* @__PURE__ */ new Map();
    for (const row of doc.querySelectorAll(".planning-step")) {
      const summary2 = row.querySelector(":scope > summary") || row;
      const hrid = itemFromIcon(summary2.querySelector(".planning-row-icon")) || byName.get(summary2.querySelector(".planning-step-name")?.textContent.trim());
      const policy = activePolicy(summary2);
      if (hrid && policy) policies.set(hrid, policy);
    }
    let error = null;
    if (!goals.length) error = "No active goals found in the MWITools planning tab.";
    else if (!policies.size) error = "Press \u201CCalculate Step 2\u201D in the MWITools planning tab first, so the production choices are shown.";
    return { goals, policies, error };
  }
  function inventoryCounts(items) {
    const counts = /* @__PURE__ */ new Map();
    for (const item of items.values ? items.values() : items) {
      if (item.itemLocationHrid !== INVENTORY6 || (item.enhancementLevel || 0) !== 0) continue;
      counts.set(item.itemHrid, (counts.get(item.itemHrid) || 0) + item.count);
    }
    return counts;
  }
  var actionsCache = /* @__PURE__ */ new WeakMap();
  function productionActions(data) {
    if (actionsCache.has(data)) return actionsCache.get(data);
    const byItem = /* @__PURE__ */ new Map();
    const actions = Object.values(data.actionDetailMap).filter((action) => action.function === "/action_functions/production" && action.outputItems?.length).sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
    for (const action of actions) {
      const hrid = action.outputItems[0].itemHrid;
      if (!byItem.has(hrid)) byItem.set(hrid, action);
    }
    actionsCache.set(data, byItem);
    return byItem;
  }
  var gatherCache = /* @__PURE__ */ new WeakMap();
  function gatheringSources(data) {
    if (gatherCache.has(data)) return gatherCache.get(data);
    const byItem = /* @__PURE__ */ new Map();
    const actions = Object.values(data.actionDetailMap).filter((action) => action.function === "/action_functions/gathering").sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
    for (const action of actions) {
      for (const drop of action.dropTable || []) {
        const p2 = drop.dropRate ?? 1;
        const low = drop.minCount ?? 1;
        const high = drop.maxCount ?? low;
        const spread = (high + low) / 2;
        const mean = p2 * spread;
        const variance = p2 * (((high - low + 1) ** 2 - 1) / 12 + spread ** 2) - mean ** 2;
        const best = byItem.get(drop.itemHrid);
        if (mean > 0 && (!best || mean > best.mean)) byItem.set(drop.itemHrid, { action, mean, variance });
      }
    }
    gatherCache.set(data, byItem);
    return byItem;
  }
  var SAFETY_Z = 1.28;
  function gatherCount(need, { mean, variance }) {
    let count3 = Math.max(1, Math.ceil(need / mean - 1e-9));
    while (count3 * mean - SAFETY_Z * Math.sqrt(count3 * variance) < need - 1e-9) count3++;
    return count3;
  }
  function inputsOf(action) {
    const inputs = (action.inputItems || []).map((input) => ({ hrid: input.itemHrid, count: input.count }));
    if (action.upgradeItemHrid) inputs.push({ hrid: action.upgradeItemHrid, count: 1 });
    return inputs;
  }
  function goalDemand(goals, data, houseLevels) {
    const name = (hrid) => data.itemDetailMap[hrid]?.name || hrid.split("/").pop();
    const demand = /* @__PURE__ */ new Map();
    const add = (hrid, count3) => demand.set(hrid, (demand.get(hrid) || 0) + count3);
    const titles = [];
    for (const goal of goals) {
      if (goal.kind === "house") {
        const room = data.houseRoomDetailMap?.[goal.hrid];
        const current = houseLevels[goal.hrid] || 0;
        titles.push(`${room?.name || goal.hrid.split("/").pop()} \u2192 ${goal.target}`);
        for (let level = current + 1; level <= goal.target; level++) {
          for (const cost of room?.upgradeCostsMap?.[level] || []) add(cost.itemHrid, cost.count);
        }
      } else {
        titles.push(`${name(goal.hrid)} \xD7${goal.target}`);
        add(goal.hrid, goal.target);
      }
    }
    return { demand, titles };
  }
  function resolve(goalItems, produced, actions, owned, name) {
    const demand = new Map(goalItems);
    const add = (hrid, count3) => demand.set(hrid, (demand.get(hrid) || 0) + count3);
    const order = [];
    const seen = /* @__PURE__ */ new Set();
    const visit = (hrid) => {
      if (seen.has(hrid)) return;
      seen.add(hrid);
      if (produced(hrid)) for (const input of inputsOf(actions.get(hrid))) visit(input.hrid);
      order.push(hrid);
    };
    for (const hrid of demand.keys()) visit(hrid);
    const rows = /* @__PURE__ */ new Map();
    for (const hrid of [...order].reverse()) {
      const wanted = demand.get(hrid) || 0;
      const have6 = owned.get(hrid) || 0;
      const need = Math.max(0, wanted - have6);
      const row = { hrid, name: name(hrid), wanted, have: have6, need };
      if (produced(hrid)) {
        const action = actions.get(hrid);
        const perAction = action.outputItems[0].count || 1;
        row.action = action;
        row.count = Math.ceil(need / perAction - 1e-9);
        for (const input of inputsOf(action)) add(input.hrid, row.count * input.count);
      }
      rows.set(hrid, row);
    }
    return { order, rows };
  }
  function buildTrain({ goals, policies }, data, { owned, houseLevels = {}, skills = {} }) {
    const actions = productionActions(data);
    const name = (hrid) => data.itemDetailMap[hrid]?.name || hrid.split("/").pop();
    const warnings = [];
    const { demand, titles } = goalDemand(goals, data, houseLevels);
    const produced = (hrid) => PRODUCE.has(policies.get(hrid)) && actions.has(hrid);
    for (const [hrid, policy] of policies) {
      if (policy === "mixed") warnings.push(`${name(hrid)} has different choices per goal; the train makes all of it.`);
      if (PRODUCE.has(policy) && !actions.has(hrid)) warnings.push(`${name(hrid)} has no production action; get it yourself.`);
    }
    const { order, rows } = resolve(demand, produced, actions, owned, name);
    const height = /* @__PURE__ */ new Map();
    const heightOf = (hrid) => {
      if (height.has(hrid)) return height.get(hrid);
      const row = rows.get(hrid);
      const value = row?.action ? 1 + Math.max(0, ...inputsOf(row.action).map((input) => heightOf(input.hrid))) : 0;
      height.set(hrid, value);
      return value;
    };
    const madeRows = order.map((hrid) => rows.get(hrid)).filter((row) => row.action);
    const stops = madeRows.filter((row) => row.count > 0).sort((a, b) => heightOf(a.hrid) - heightOf(b.hrid) || a.action.type.localeCompare(b.action.type) || (a.action.sortIndex ?? 0) - (b.action.sortIndex ?? 0)).map((row) => {
      const required = row.action.levelRequirement;
      return {
        itemHrid: row.hrid,
        name: row.name,
        actionHrid: row.action.hrid,
        actionName: row.action.name,
        skill: row.action.type.split("/").pop(),
        category: row.action.category,
        count: row.count,
        output: row.count * (row.action.outputItems[0].count || 1),
        need: row.need,
        levelRequired: required?.level || 0,
        level: skills[required?.skillHrid] ?? null,
        skillHrid: required?.skillHrid || null
      };
    });
    const covered = madeRows.filter((row) => row.count === 0).map((row) => row.name);
    const shortages = order.map((hrid) => rows.get(hrid)).filter((row) => !row.action && row.need > 0).map((row) => ({ itemHrid: row.hrid, name: row.name, need: Math.ceil(row.need - 1e-9), buy: policies.get(row.hrid) === "buy" }));
    const sources = gatheringSources(data);
    const gather = shortages.filter((shortage) => sources.has(shortage.itemHrid)).map((shortage) => {
      const { action, mean, variance } = sources.get(shortage.itemHrid);
      const required = action.levelRequirement;
      const level = skills[required?.skillHrid] ?? null;
      const count3 = gatherCount(shortage.need, { mean, variance });
      return {
        itemHrid: shortage.itemHrid,
        name: shortage.name,
        actionHrid: action.hrid,
        actionName: action.name,
        skill: action.type.split("/").pop(),
        category: action.category,
        count: count3,
        output: Math.round(count3 * mean),
        need: shortage.need,
        levelRequired: required?.level || 0,
        level,
        skillHrid: required?.skillHrid || null,
        gather: true,
        on: level !== null && level >= (required?.level || 0)
      };
    });
    return { title: titles.join(", "), stops, gather, covered, shortages, warnings };
  }
  function trainStops(train) {
    return [...(train.gather || []).filter((item) => item.on), ...train.made || train.stops];
  }
  function toBuy(train) {
    const gathered = new Set((train.gather || []).filter((item) => item.on).map((item) => item.itemHrid));
    return train.shortages.filter((shortage) => !gathered.has(shortage.itemHrid));
  }
  var COIN10 = "/items/coin";
  function boughtCost(rows, price) {
    let coins10 = 0;
    const unpriced = [];
    for (const row of rows.values()) {
      if (row.action || row.need <= 0 || row.hrid === COIN10) continue;
      const each = price(row.hrid);
      if (each === null || each === void 0) unpriced.push(row.name);
      else coins10 += Math.ceil(row.need - 1e-9) * each;
    }
    return { coins: coins10, unpriced };
  }
  function planCosts({ goals, policies }, data, { owned, houseLevels = {}, price }) {
    const actions = productionActions(data);
    const name = (hrid) => data.itemDetailMap[hrid]?.name || hrid.split("/").pop();
    const { demand } = goalDemand(goals, data, houseLevels);
    const run = (produced) => resolve(demand, produced, actions, owned, name).rows;
    const current = run((hrid) => PRODUCE.has(policies.get(hrid)) && actions.has(hrid));
    const wanted = new Map([...current.values()].map((row) => [row.hrid, row.wanted]));
    return {
      wanted,
      current: boughtCost(current, price),
      buy: boughtCost(run(() => false), price),
      single: boughtCost(run((hrid) => demand.has(hrid) && actions.has(hrid)), price),
      chain: boughtCost(run((hrid) => actions.has(hrid)), price)
    };
  }
  function itemCosts(hrid, count3, data, { owned, price }) {
    const actions = productionActions(data);
    const name = (h3) => data.itemDetailMap[h3]?.name || h3.split("/").pop();
    const run = (produced) => boughtCost(resolve(/* @__PURE__ */ new Map([[hrid, count3]]), produced, actions, owned, name).rows, price);
    const craftable = actions.has(hrid);
    return {
      buy: run(() => false),
      single: craftable ? run((h3) => h3 === hrid) : null,
      chain: craftable ? run((h3) => actions.has(h3)) : null
    };
  }

  // src/plan-costs-ui.js
  var RECOMPUTE_MS = 3e3;
  var RETRY_MS = 3e4;
  var ROW_TIP = "Market cost of the materials you would buy (lowest ask), after what is in your inventory. One step: make it from bought ingredients. Full chain: make everything that has a recipe, buy only raw materials. This row is counted on its own, so inventory shared with other rows counts here too. Artisan Tea is not counted.";
  var TOTAL_TIP = "Market cost of the materials to buy for the whole plan (lowest ask), after what is in your inventory. Your choices is what the plan train lists as missing materials. Coins for the upgrade itself and Artisan Tea are not counted.";
  var c = { loading: false, triedAt: 0, priceError: null, signature: "", at: 0 };
  function costText(cost) {
    if (!cost) return null;
    let text = shortCoins(cost.coins);
    if (cost.unpriced.length) text += " + ?";
    return text;
  }
  function costLine(options) {
    const priced = options.filter((option) => option.cost && !option.cost.unpriced.length);
    const best = priced.length > 1 ? Math.min(...priced.map((option) => option.cost.coins)) : null;
    const unpriced = [...new Set(options.flatMap((option) => option.cost?.unpriced || []))];
    const parts = options.filter((option) => option.cost).map((option) => {
      const cheapest = best !== null && !option.cost.unpriced.length && option.cost.coins === best;
      return `<span class="${cheapest ? "mwia-plan-cost-best" : ""}">${esc(option.label)} ${costText(option.cost)}</span>`;
    });
    let html = parts.join(" \xB7 ");
    if (unpriced.length) html += ` <span class="mwia-dim">(no price: ${esc(unpriced.join(", "))})</span>`;
    return html;
  }
  function place(html, existing, create) {
    const element = existing || create();
    if (element.dataset.html !== html) {
      element.dataset.html = html;
      element.innerHTML = html;
    }
  }
  function costElement(className, tip2) {
    const element = document.createElement("div");
    element.className = className;
    element.title = tip2;
    element.addEventListener("click", (event) => event.preventDefault());
    enableTapTips(element);
    return element;
  }
  function shownRequired(summary2) {
    const text = summary2.querySelector(".planning-step-count")?.textContent || summary2.textContent;
    const match = text.match(/Required\s*([\d.,]+\s*[kmb]?)/i);
    return match ? parseCoins(match[1].replace(/\s+/g, "")) : null;
  }
  function showPlanCosts(win2) {
    const steps = document.querySelectorAll(".planning-step");
    if (!steps.length) return;
    if (!state.character) return;
    const data = getClientData();
    if (!data || pricesAge() === null && !c.priceError) {
      if (!c.loading && Date.now() - c.triedAt > RETRY_MS) {
        c.loading = true;
        c.triedAt = Date.now();
        Promise.all([data || loadClientData(win2), loadPrices()]).then(() => {
          c.priceError = null;
        }).catch((error) => {
          c.priceError = error.message;
        }).finally(() => {
          c.loading = false;
          c.at = 0;
          if (getClientData()) showPlanCosts(win2);
        });
      }
      return;
    }
    const plan = readPlanningTab(document, data);
    const signature2 = JSON.stringify([plan.goals, [...plan.policies], pricesAge() !== null && Date.now() - pricesAge()]);
    const fresh = signature2 === c.signature && Date.now() - c.at < RECOMPUTE_MS;
    const missing = [...steps].some((step) => !step.querySelector(".mwia-plan-cost")) || document.querySelector(".planning-calculate-bar") && !document.querySelector(".mwia-plan-costs");
    if (fresh && !missing) return;
    c.signature = signature2;
    c.at = Date.now();
    const owned = inventoryCounts(state.items);
    const houseLevels = {};
    for (const room of Object.values(state.character.characterHouseRoomMap || {})) houseLevels[room.houseRoomHrid] = room.level;
    const price = (hrid) => askPrice(hrid);
    let totalHtml;
    let wanted = /* @__PURE__ */ new Map();
    if (c.priceError) totalHtml = `Material cost: ${esc(c.priceError)}`;
    else if (!plan.goals.length) totalHtml = "Material cost: no active goals.";
    else {
      const totals2 = planCosts(plan, data, { owned, houseLevels, price });
      wanted = totals2.wanted;
      totalHtml = "<b>Materials to buy:</b> " + costLine([
        { label: "your choices", cost: totals2.current },
        { label: "all Buy", cost: totals2.buy },
        { label: "all One step", cost: totals2.single },
        { label: "all Full chain", cost: totals2.chain }
      ]);
    }
    for (const stage of document.querySelectorAll(".planning-stage")) {
      const bar = stage.querySelector(".planning-calculate-bar");
      if (!bar) continue;
      place(totalHtml, stage.querySelector(".mwia-plan-costs"), () => {
        const element = costElement("mwia-plan-costs", TOTAL_TIP);
        bar.before(element);
        return element;
      });
    }
    const byName = new Map(Object.values(data.itemDetailMap).map((item) => [item.name, item.hrid]));
    for (const step of steps) {
      const summary2 = step.querySelector(":scope > summary") || step;
      const use = summary2.querySelector(".planning-row-icon use");
      const bare = (use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").split("#")[1];
      const hrid = bare ? "/items/" + bare : byName.get(summary2.querySelector(".planning-step-name")?.textContent.trim());
      const count3 = wanted.get(hrid) || shownRequired(summary2);
      let html = "";
      if (c.priceError || !hrid || !data.itemDetailMap[hrid]) html = "";
      else if (!count3) html = '<span class="mwia-dim">Not needed with the current choices</span>';
      else {
        const costs = itemCosts(hrid, count3, data, { owned, price });
        html = costLine([
          { label: "Buy", cost: costs.buy },
          { label: "One step", cost: costs.single },
          { label: "Full chain", cost: costs.chain }
        ]);
      }
      place(html, summary2.querySelector(".mwia-plan-cost"), () => {
        const element = costElement("mwia-plan-cost", ROW_TIP);
        const policySwitch = summary2.querySelector(".planning-policy-switch");
        if (policySwitch) policySwitch.after(element);
        else summary2.appendChild(element);
        return element;
      });
    }
  }

  // src/train-ui.js
  var STORE_PREFIX = "mwia-train:";
  var LOW_KEY = "mwia-train-low";
  var NOT_QUEUED_AFTER_MS = 4e3;
  var t3 = {
    win: null,
    train: null,
    // { title, stops, made, gather, index, shortages, covered, warnings }
    root: null,
    notice: null,
    // { kind, text }
    collapsed: false,
    low: false,
    // phones: panel at the bottom of the screen instead of the top
    seenActionIds: /* @__PURE__ */ new Set(),
    filled: /* @__PURE__ */ new WeakMap(),
    // count input -> stop index it was filled for
    queueClickTimer: null
  };
  var n3 = (value) => Math.ceil(value).toLocaleString("en-US");
  var characterId = () => state.character?.character?.id ?? null;
  var storeKey = () => STORE_PREFIX + (characterId() ?? "unknown");
  function save3() {
    try {
      if (t3.train) localStorage.setItem(storeKey(), JSON.stringify(t3.train));
      else localStorage.removeItem(storeKey());
    } catch {
    }
  }
  function restore() {
    try {
      t3.train = JSON.parse(localStorage.getItem(storeKey()) || "null");
    } catch {
      t3.train = null;
    }
  }
  function rememberQueuedActions() {
    for (const action of state.character?.characterActions || []) {
      if (action.id !== void 0 && action.id !== null) t3.seenActionIds.add(action.id);
    }
  }
  function currentStop() {
    return t3.train?.stops[t3.train.index] || null;
  }
  function setNotice(kind, text, diag = "") {
    t3.notice = text ? { kind, text, diag } : null;
    render();
  }
  async function startFromPlanning() {
    try {
      const data = getClientData() || await loadClientData(t3.win);
      const plan = readPlanningTab(document, data);
      if (plan.error) throw new Error(plan.error);
      await startTrain(plan);
    } catch (error) {
      showStandaloneError(error.message);
    }
  }
  async function startTrain(plan) {
    try {
      const data = getClientData() || await loadClientData(t3.win);
      if (!state.character) throw new Error("Character data not received yet. Reload the game page with the advisor installed.");
      const houseLevels = {};
      for (const room of Object.values(state.character.characterHouseRoomMap || {})) houseLevels[room.houseRoomHrid] = room.level;
      const skills = {};
      for (const skill of state.character.characterSkills || []) skills[skill.skillHrid] = skill.level;
      const train = buildTrain(plan, data, { owned: inventoryCounts(state.items), houseLevels, skills });
      if (plan.title) train.title = plan.title;
      t3.train = { ...train, made: train.stops, index: 0 };
      t3.train.stops = trainStops(t3.train);
      t3.collapsed = isNarrow();
      t3.notice = null;
      rememberQueuedActions();
      save3();
      render();
      if (train.stops.length) goToCurrent();
    } catch (error) {
      showStandaloneError(error.message);
    }
  }
  function showStandaloneError(text) {
    if (!t3.train) t3.train = { title: "Plan train", stops: [], index: 0, shortages: [], covered: [], warnings: [], failed: true };
    setNotice("bad", text);
  }
  async function goToCurrent() {
    const stop = currentStop();
    if (!stop) return;
    const data = getClientData() || await loadClientData(t3.win);
    const action = data.actionDetailMap[stop.actionHrid];
    const opened = action && await openAction(t3.win, action, data);
    if (currentStop() !== stop) return;
    if (opened) fillPanel();
    else setNotice("warn", `Could not open ${stop.actionName} automatically. Open it yourself (${cap(stop.skill)}) and the count is filled in.`, action ? navDiagnostics() : `${stop.actionHrid} not in game data`);
  }
  function advance(step = 1) {
    if (!t3.train) return;
    clearTimeout(t3.queueClickTimer);
    t3.train.index = Math.max(0, Math.min(t3.train.stops.length, t3.train.index + step));
    t3.notice = null;
    save3();
    render();
    if (currentStop()) goToCurrent();
  }
  function toggleGather(itemHrid) {
    const item = t3.train?.gather?.find((candidate) => candidate.itemHrid === itemHrid);
    if (!item) return;
    item.on = !item.on;
    const done2 = new Set(t3.train.stops.slice(0, t3.train.index).map((stop) => stop.actionHrid));
    const all = trainStops(t3.train);
    const passed = all.filter((stop) => done2.has(stop.actionHrid));
    t3.train.stops = [...passed, ...all.filter((stop) => !done2.has(stop.actionHrid))];
    t3.train.index = passed.length;
    t3.notice = null;
    save3();
    render();
  }
  function endTrain() {
    clearTimeout(t3.queueClickTimer);
    document.querySelectorAll(".mwia-train-target").forEach((node) => node.classList.remove("mwia-train-target"));
    t3.train = null;
    t3.notice = null;
    save3();
    render();
  }
  function fillPanel() {
    const stop = currentStop();
    document.querySelectorAll(".mwia-train-target").forEach((node) => node.classList.remove("mwia-train-target"));
    if (!stop) return;
    const found = findActionPanel(stop.actionName);
    if (!found) return;
    if (t3.filled.get(found.input) !== t3.train.index) {
      t3.filled.set(found.input, t3.train.index);
      setReactInput(found.input, stop.count);
    }
    if (found.buttons) {
      found.buttons.classList.add("mwia-train-target");
      if (!found.buttons.dataset.mwiaTrain) {
        found.buttons.dataset.mwiaTrain = "1";
        found.buttons.addEventListener("click", onQueueButtonClick, true);
      }
    }
  }
  function onQueueButtonClick(event) {
    if (!currentStop() || !event.target.closest?.("button")) return;
    const index = t3.train.index;
    clearTimeout(t3.queueClickTimer);
    t3.queueClickTimer = setTimeout(() => {
      if (t3.train?.index === index) {
        setNotice("warn", "Nothing reached the queue yet. If your action queue is full, wait for a free slot and click \u201CAdd to queue\u201D again \u2014 or press \u201CNext \u25B8\u201D to move on anyway.");
      }
    }, NOT_QUEUED_AFTER_MS);
  }
  function onGameMessage(type, data) {
    scheduleScan10();
    if (type === "init_character_data") {
      t3.seenActionIds = /* @__PURE__ */ new Set();
      restore();
      rememberQueuedActions();
      render();
      return;
    }
    if (type !== "actions_updated") return;
    const stop = currentStop();
    let queued = false;
    for (const action of data?.endCharacterActions || []) {
      if (!action || action.id === void 0 || action.id === null || t3.seenActionIds.has(action.id)) continue;
      t3.seenActionIds.add(action.id);
      if (!action.isDone && stop && action.actionHrid === stop.actionHrid) queued = true;
    }
    if (queued) advance();
  }
  var cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  function levelNote(stop) {
    if (stop.level === null || stop.level >= stop.levelRequired) return "";
    return ` <span class="mwia-bad" title="Your ${esc(cap(stop.skill))} level is ${stop.level}">\u26A0 needs ${esc(cap(stop.skill))} ${stop.levelRequired}</span>`;
  }
  function render() {
    if (!t3.root) return;
    const train = t3.train;
    t3.root.classList.toggle("mwia-hidden", !train);
    t3.root.classList.toggle("mwia-train-low", t3.low);
    if (!train) return;
    const stop = currentStop();
    const done2 = train.index >= train.stops.length && !train.failed;
    const headline = done2 ? "All stops queued" : stop ? `${train.index + 1}/${train.stops.length} \xB7 ${esc(stop.actionName)} \xD7${n3(stop.count)}` : "";
    let html = `<div class="mwia-train-head">
        <button class="mwia-link" data-train="toggle" title="Show or hide the stops">${t3.collapsed ? "\u25B8" : "\u25BE"}</button>
        <b>\u{1F682} ${esc(train.title)}</b>
        <button class="mwia-link mwia-narrow-only" data-train="move" title="Move to the ${t3.low ? "top" : "bottom"} of the screen">\u21C5</button>
        <button class="mwia-link" data-train="end" title="End the train">\u2715</button>
      </div>`;
    if (headline) html += `<div class="mwia-train-now">${headline}</div>`;
    if (t3.notice) html += `<div class="mwia-notice mwia-notice-${t3.notice.kind}">${esc(t3.notice.text)}${t3.notice.diag ? `<div class="mwia-notice-diag">${esc(t3.notice.diag)}</div>` : ""}</div>`;
    if (stop && !train.failed) {
      if (!t3.collapsed) html += `<p class="mwia-dim">Click the game's <b>Add to queue</b>; the next stop opens when the game confirms it.</p>`;
      html += `<div class="mwia-train-buttons">
            <button class="mwia-cart-btn" data-train="back" ${train.index === 0 ? "disabled" : ""}>\u25C2 Back</button>
            <button class="mwia-cart-btn" data-train="open">Open stop</button>
            <button class="mwia-cart-btn" data-train="next">Next \u25B8</button>
          </div>`;
    }
    if (!t3.collapsed && !train.failed) {
      if (done2) {
        html += `<p>Everything is in the queue. When it has finished, ${/→/.test(train.title) ? "upgrade the house room" : "the goal items are ready"}.</p>`;
      }
      html += `<ol class="mwia-train-stops">${train.stops.map((s2, i) => `<li class="${i < train.index ? "mwia-train-done" : i === train.index ? "mwia-train-current" : ""}">
                <span>${esc(s2.actionName)}</span> <span class="mwia-num"${s2.gather ? ` title="${n3(s2.count)} actions give about ${n3(s2.output)}; ${n3(s2.need)} needed"` : ""}>\xD7${n3(s2.count)}</span>
                <span class="mwia-dim">${esc(cap(s2.skill))}</span>${levelNote(s2)}${s2.gather && i >= train.index ? ` <button class="mwia-link" data-train="gather" data-item="${esc(s2.itemHrid)}" title="Buy ${esc(s2.name)} instead of gathering it">buy instead</button>` : ""}</li>`).join("")}</ol>`;
      if (!train.stops.length) html += `<p>Nothing needs to be made \u2014 your inventory already covers the plan.</p>`;
      if (train.covered.length) html += `<p class="mwia-dim">Already in inventory: ${esc(train.covered.join(", "))}</p>`;
      const buyable = toBuy(train).filter((s2) => s2.itemHrid !== "/items/coin");
      const coins10 = train.shortages.find((s2) => s2.itemHrid === "/items/coin");
      const gatherable = new Map((train.gather || []).map((item) => [item.itemHrid, item]));
      const gatherButton = (s2) => {
        const item = gatherable.get(s2.itemHrid);
        if (!item) return "";
        return ` <button class="mwia-link" data-train="gather" data-item="${esc(s2.itemHrid)}" title="Gather it yourself (${esc(cap(item.skill))} ${item.levelRequired})">gather</button>${levelNote(item)}`;
      };
      if (buyable.length) {
        html += `<p><b>Missing materials:</b> ${buyable.map((s2) => `${esc(s2.name)} \xD7${n3(s2.need)}${gatherButton(s2)}`).join(", ")}
              <button class="mwia-cart-btn" data-train="cart" title="Add the missing materials to the MWITools shopping cart">\u{1F6D2} Add to cart</button></p>`;
      }
      if (coins10) html += `<p class="mwia-warn">Coins short: ${n3(coins10.need)}</p>`;
      for (const warning of train.warnings) html += `<p class="mwia-warn">\u26A0 ${esc(warning)}</p>`;
    }
    t3.root.innerHTML = html;
  }
  async function onClick7(event) {
    const button2 = event.target.closest("[data-train]");
    if (!button2) return;
    const action = button2.dataset.train;
    if (action === "toggle") {
      t3.collapsed = !t3.collapsed;
      render();
    } else if (action === "move") {
      t3.low = !t3.low;
      try {
        localStorage.setItem(LOW_KEY, t3.low ? "1" : "");
      } catch {
      }
      render();
    } else if (action === "end") endTrain();
    else if (action === "back") advance(-1);
    else if (action === "next") advance(1);
    else if (action === "open") {
      t3.notice = null;
      render();
      goToCurrent();
    } else if (action === "gather") toggleGather(button2.dataset.item);
    else if (action === "cart") {
      const items = toBuy(t3.train).filter((s2) => s2.itemHrid !== "/items/coin").map((s2) => ({ hrid: s2.itemHrid, quantity: s2.need, enhancementLevel: 0 }));
      try {
        const outcome = await addToCart(t3.win, items);
        const parts = [];
        if (outcome.added.length) parts.push(`${outcome.added.length} added`);
        if (outcome.updated.length) parts.push(`${outcome.updated.length} topped up`);
        if (outcome.present.length) parts.push(`${outcome.present.length} already there`);
        if (outcome.failed.length) parts.push(`${outcome.failed.length} failed`);
        setNotice(outcome.failed.length ? "warn" : "ok", "Shopping cart: " + parts.join(", ") + ".");
      } catch (error) {
        setNotice("bad", error.message);
      }
    }
  }
  function injectStartButtons() {
    for (const stage of document.querySelectorAll(".planning-stage")) {
      if (stage.querySelector(".mwia-train-start")) continue;
      const bar = stage.querySelector(".planning-calculate-bar");
      if (!bar) continue;
      const button2 = document.createElement("button");
      button2.type = "button";
      button2.className = "mwia-train-start";
      button2.textContent = "\u{1F682} Plan train";
      button2.title = "MWI Advisor: walk through these production steps in order, with counts filled in";
      button2.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startFromPlanning();
      });
      bar.appendChild(button2);
    }
  }
  var scanQueued = false;
  function scheduleScan10() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      injectStartButtons();
      showPlanCosts(t3.win);
      if (currentStop()) fillPanel();
    });
  }
  function trainActionsLeft() {
    if (!t3.train) return [];
    return trainStops(t3.train).slice(t3.train.index || 0).map((stop) => stop.actionHrid).filter(Boolean);
  }
  function mountPlanTrain(win2) {
    t3.win = win2;
    t3.root = document.createElement("div");
    t3.root.className = "mwia-train mwia-hidden";
    t3.root.addEventListener("click", onClick7);
    enableTapTips(t3.root);
    document.body.appendChild(t3.root);
    try {
      t3.low = !!localStorage.getItem(LOW_KEY);
    } catch {
      t3.low = false;
    }
    restore();
    rememberQueuedActions();
    render();
    onStateChange(onGameMessage);
    new MutationObserver(scheduleScan10).observe(document.body, { childList: true, subtree: true });
    scheduleScan10();
  }

  // src/enhance-loop.js
  var ENHANCE_ACTION = "/actions/enhancing/enhance";
  var DECOMPOSE_ACTION = "/actions/alchemy/decompose";
  function hashItem2(hash2) {
    const parts = String(hash2 || "").split("::");
    return parts.length >= 4 && parts[2].startsWith("/items/") ? { itemHrid: parts[2], level: Number(parts[3]) || 0 } : null;
  }
  function newLoop({ itemHrid, target, protect = null, catalyst = null, total, heldTarget = 0, perItem = [] }) {
    return { itemHrid, target, protect, catalyst, total: Math.max(0, Math.floor(total) || 0), perItem, heldAtStart: heldTarget, queued: 0, ended: 0, seen: [], endedIds: [], decompose: null };
  }
  function loopActions(loop, actions) {
    let changed2 = false;
    for (const a of actions || []) {
      if (!a || a.id === void 0 || a.id === null) continue;
      const item = hashItem2(a.primaryItemHash);
      if (!item || item.itemHrid !== loop.itemHrid) continue;
      if (a.actionHrid === ENHANCE_ACTION) {
        const known = loop.seen.includes(a.id);
        if (!known && !a.isDone && loop.queued < loop.total) {
          loop.seen.push(a.id);
          loop.queued++;
          changed2 = true;
        } else if (known && a.isDone && !loop.endedIds.includes(a.id)) {
          loop.endedIds.push(a.id);
          loop.ended++;
          changed2 = true;
        }
      } else if (a.actionHrid === DECOMPOSE_ACTION && item.level === loop.target && !a.isDone && !loop.decompose) {
        loop.decompose = { id: a.id, count: Number(a.maxCount) || null };
        changed2 = true;
      }
    }
    return changed2;
  }
  function loopStatus(loop, { inQueue = 0, heldZero = 0, heldTarget = 0 } = {}) {
    const left = Math.max(0, loop.total - loop.queued);
    let phase;
    if (loop.decompose) phase = "done";
    else if (left > 0) phase = heldZero > 0 ? "queue" : inQueue > 0 ? "running" : heldTarget > 0 ? "decompose" : "short";
    else if (inQueue > 0) phase = "running";
    else phase = heldTarget > 0 ? "decompose" : "empty";
    return { phase, left, queued: loop.queued, ended: loop.ended, total: loop.total, inQueue, heldZero, heldTarget };
  }
  function enhancingInQueue(actions, itemHrid) {
    return (actions || []).filter((a) => a && !a.isDone && a.actionHrid === ENHANCE_ACTION && hashItem2(a.primaryItemHash)?.itemHrid === itemHrid).length;
  }
  function loopCart(loop, count3, have6 = () => 0) {
    return loop.perItem.map((p2) => ({ hrid: p2.hrid, quantity: Math.ceil(p2.quantity * count3 - 1e-9) - have6(p2.hrid) })).filter((p2) => p2.quantity > 0);
  }

  // src/enhance-loop-ui.js
  var STORE_PREFIX2 = "mwia-loop:";
  var MINIMIZED_KEY = "mwia-loop-min";
  var ICON_POSITION_KEY = "mwia-loop-icon-pos";
  var INVENTORY7 = "/item_locations/inventory";
  var NOT_QUEUED_AFTER_MS2 = 4e3;
  var L = {
    win: null,
    root: null,
    icon: null,
    // the 🧪 the panel shrinks to (➖), only while a loop runs
    minimized: false,
    loop: null,
    notice: null,
    // { kind, text, diag }
    collapsed: false,
    timer: null,
    hooked: /* @__PURE__ */ new WeakSet()
    // the game's button rows the loop listens to
  };
  var n4 = (value) => Math.round(value).toLocaleString("en-US");
  var characterId2 = () => state.character?.character?.id ?? null;
  var storeKey2 = () => STORE_PREFIX2 + (characterId2() ?? "unknown");
  function save4() {
    try {
      if (L.loop) localStorage.setItem(storeKey2(), JSON.stringify(L.loop));
      else localStorage.removeItem(storeKey2());
    } catch {
    }
  }
  function restore2() {
    try {
      L.loop = JSON.parse(localStorage.getItem(storeKey2()) || "null");
    } catch {
      L.loop = null;
    }
  }
  var heldAt2 = (hrid, level = 0) => [...state.items.values()].filter((i) => i.itemHrid === hrid && i.itemLocationHrid === INVENTORY7 && (i.enhancementLevel || 0) === level).reduce((sum, i) => sum + (i.count || 0), 0);
  var ownedHash = (hrid, level = 0) => hrid && characterId2() !== null && heldAt2(hrid, level) > 0 ? inventoryItemHash(characterId2(), hrid, level) : null;
  function status() {
    const loop = L.loop;
    return loopStatus(loop, { inQueue: enhancingInQueue(state.character?.characterActions, loop.itemHrid), heldZero: heldAt2(loop.itemHrid, 0), heldTarget: heldAt2(loop.itemHrid, loop.target) });
  }
  function setMinimized(minimized) {
    L.minimized = minimized;
    try {
      localStorage.setItem(MINIMIZED_KEY, minimized ? "1" : "");
    } catch {
    }
    render2();
  }
  function setNotice2(kind, text, diag = "") {
    L.notice = text ? { kind, text, diag } : null;
    render2();
  }
  function startLoop(options) {
    const total = heldAt2(options.itemHrid, 0);
    clearTimeout(L.timer);
    L.loop = newLoop({ ...options, total, heldTarget: heldAt2(options.itemHrid, options.target) });
    L.notice = null;
    L.collapsed = false;
    setMinimized(false);
    save4();
    render2();
    if (total > 0) openNext();
  }
  async function openNext() {
    const loop = L.loop;
    if (!loop) return;
    const hash2 = ownedHash(loop.itemHrid, 0);
    const protect = loop.protect ? { hash: ownedHash(loop.protect.itemHrid, 0), from: loop.protect.from } : null;
    const opened = await openEnhancing(hash2, loop.target, protect);
    if (opened === "item") L.notice = null;
    else if (opened === "partial") L.notice = { kind: "info", text: `Opened with the item, but couldn't put ${itemName(loop.protect.itemHrid)} in as protection from +${loop.protect.from} \u2013 do that in the game.`, diag: navDiagnostics() };
    else L.notice = { kind: "warn", text: `Could not open ${itemName(loop.itemHrid)} in Enhancing${hash2 ? "" : " \u2013 no +0 in the inventory"}. Open it yourself with the target +${loop.target}.`, diag: navDiagnostics() };
    render2();
    scheduleMark();
  }
  async function openDecompose() {
    const loop = L.loop;
    if (!loop) return;
    const count3 = heldAt2(loop.itemHrid, loop.target);
    const catalyst = loop.catalyst ? { hash: ownedHash(loop.catalyst, 0) } : null;
    const opened = await openAlchemy(ownedHash(loop.itemHrid, loop.target), "Decompose", count3, catalyst);
    if (opened === "item") L.notice = null;
    else if (opened === "partial") L.notice = { kind: "info", text: `Opened with the item, but couldn't put ${itemName(loop.catalyst)} in as the catalyst \u2013 do that in the game.`, diag: navDiagnostics() };
    else L.notice = { kind: "warn", text: `Could not open Decompose. Pick ${itemName(loop.itemHrid)} +${loop.target} there yourself and enter ${count3}.`, diag: navDiagnostics() };
    render2();
    scheduleMark();
  }
  function endLoop() {
    clearTimeout(L.timer);
    unmark3();
    L.loop = null;
    L.notice = null;
    save4();
    render2();
  }
  function unmark3() {
    document.querySelectorAll(".mwia-loop-target").forEach((node) => node.classList.remove("mwia-loop-target", "mwia-train-target"));
  }
  function markWindow() {
    unmark3();
    if (!L.loop) return;
    const st = status();
    const loop = L.loop;
    const wanted = st.phase === "queue" ? "enhancing" : st.phase === "decompose" ? "alchemy" : null;
    if (!wanted) return;
    for (const p2 of levelingPanels()) {
      const item = hashItem2(p2.itemHash);
      if (p2.kind !== wanted || !p2.buttons || item?.itemHrid !== loop.itemHrid) continue;
      if (wanted === "alchemy" && (p2.tab !== "Decompose" || item.level !== loop.target)) continue;
      p2.buttons.classList.add("mwia-loop-target", "mwia-train-target");
      if (!L.hooked.has(p2.buttons)) {
        L.hooked.add(p2.buttons);
        p2.buttons.addEventListener("click", onGameButton, true);
      }
    }
  }
  var markQueued = false;
  function scheduleMark() {
    if (markQueued) return;
    markQueued = true;
    requestAnimationFrame(() => {
      markQueued = false;
      markWindow();
    });
  }
  function onGameButton(event) {
    if (!L.loop || !event.target.closest?.("button") || !event.currentTarget.classList.contains("mwia-loop-target")) return;
    const before = `${L.loop.queued}|${!!L.loop.decompose}`;
    clearTimeout(L.timer);
    L.timer = setTimeout(() => {
      if (L.loop && `${L.loop.queued}|${!!L.loop.decompose}` === before) {
        setNotice2("warn", "Nothing reached the queue yet. If your action queue is full, wait until a job is done and click \u201CAdd to queue\u201D again (or \u25B6 Next).");
      }
    }, NOT_QUEUED_AFTER_MS2);
  }
  function onGameMessage2(type, data) {
    if (type === "init_character_data") {
      restore2();
      render2();
      return;
    }
    if (!L.loop) return;
    if (type === "actions_updated" && loopActions(L.loop, data?.endCharacterActions)) {
      clearTimeout(L.timer);
      if (L.notice?.kind === "warn") L.notice = null;
      save4();
    }
    if (type === "actions_updated" || type === "items_updated") {
      render2();
      scheduleMark();
    }
  }
  function render2() {
    if (!L.root) return;
    const loop = L.loop;
    L.root.classList.toggle("mwia-hidden", !loop || L.minimized);
    L.icon?.classList.toggle("mwia-hidden", !loop || !L.minimized);
    if (!loop) return;
    const st = status();
    if (L.icon) {
      L.icon.querySelector(".mwia-loop-count").textContent = st.phase === "decompose" || st.phase === "done" ? `+${loop.target}` : `${n4(st.queued)}/${n4(st.total)}`;
      L.icon.classList.toggle("mwia-has-alert", st.phase === "decompose");
      L.icon.title = `\u{1F501} ${itemName(loop.itemHrid)} \u2192 +${loop.target}: ${st.phase === "decompose" ? `${n4(st.heldTarget)} ready to decompose` : `${n4(st.queued)}/${n4(st.total)} queued`} \u2013 tap to open`;
    }
    const item = esc(itemName(loop.itemHrid));
    const plus = `+${loop.target}`;
    const button2 = (action, text, title = "") => `<button class="mwia-cart-btn" data-loop="${action}"${title ? ` title="${esc(title)}"` : ""}>${text}</button>`;
    const headline = {
      queue: `${n4(st.queued)}/${n4(st.total)} queued`,
      short: `${n4(st.queued)}/${n4(st.total)} queued \u2013 no ${item} +0 left`,
      running: `All ${n4(st.queued)} queued \xB7 ${n4(st.inQueue)} still in the queue`,
      decompose: `${n4(st.heldTarget)} \xD7 ${plus} ready to decompose`,
      empty: `Done \u2013 none reached ${plus}`,
      done: `\u{1F9EA} Decompose of ${n4(loop.decompose?.count ?? st.heldTarget)} \xD7 ${plus} queued`
    }[st.phase];
    let html = `<div class="mwia-train-head">
        <button class="mwia-link" data-loop="toggle" title="Show or hide the details">${L.collapsed ? "\u25B8" : "\u25BE"}</button>
        <b>\u{1F501} ${item} \u2192 ${plus} \u{1F9EA}</b>
        <button class="mwia-link" data-loop="minimize" title="Shrink to a \u{1F9EA} icon (tap it to open again)">\u2796</button>
        <button class="mwia-link" data-loop="end" title="End the loop">\u2715</button>
      </div>
      <div class="mwia-train-now">${headline}</div>`;
    if (L.notice) html += `<div class="mwia-notice mwia-notice-${L.notice.kind}">${esc(L.notice.text)}${L.notice.diag ? `<div class="mwia-notice-diag">${esc(L.notice.diag)}</div>` : ""}</div>`;
    const buttons = [];
    if (st.phase === "queue") buttons.push(button2("next", `\u25B6 Next ${item}`, `Opens Enhancing with a +0 ${itemName(loop.itemHrid)} and the target ${plus}`));
    if (st.phase === "decompose") buttons.push(button2("decompose", `\u{1F9EA} Decompose ${n4(st.heldTarget)} \xD7 ${plus}`, `Opens Decompose with the ${n4(st.heldTarget)} ${itemName(loop.itemHrid)} ${plus} you have`));
    if (["done", "empty", "short"].includes(st.phase)) {
      if (st.heldZero > 0) buttons.push(button2("again", `\u{1F501} Again (${n4(st.heldZero)})`, `A new loop with the ${n4(st.heldZero)} +0 you have`));
      if (loop.perItem?.length) buttons.push(button2("cart", `\u{1F6D2} ${n4(loop.total)} more`, `Adds what ${n4(loop.total)} more take to the MWITools cart, less what you have`));
    }
    if (buttons.length) html += `<div class="mwia-train-buttons">${buttons.join("")}</div>`;
    if (!L.collapsed) {
      const help = {
        queue: `Click the game's <b>Add to queue</b> (or <b>Start</b>) \u2013 again for each ${item} while the window stays open. The game stops each one at ${plus}.`,
        short: `Buy more, or decompose what reached ${plus} once you have some.`,
        running: `When they are done, decompose the ${plus} here. Nothing opens by itself.`,
        decompose: `Click the game's <b>Start</b> or <b>Add to queue</b> in Decompose.`,
        empty: "",
        done: `Buy the next round with \u{1F6D2}, then \u{1F501} Again.`
      }[st.phase];
      if (help) html += `<p class="mwia-dim">${help}</p>`;
      html += `<p class="mwia-dim">In the inventory: ${n4(st.heldZero)} at +0 \xB7 ${n4(st.heldTarget)} at ${plus}${st.ended ? ` \xB7 ${n4(st.ended)} jobs done` : ""}.</p>`;
    }
    L.root.innerHTML = html;
  }
  async function onClick8(event) {
    const button2 = event.target.closest("[data-loop]");
    if (!button2 || !L.loop) return;
    const action = button2.dataset.loop;
    if (action === "toggle") {
      L.collapsed = !L.collapsed;
      render2();
    } else if (action === "minimize") setMinimized(true);
    else if (action === "end") endLoop();
    else if (action === "next") openNext();
    else if (action === "decompose") openDecompose();
    else if (action === "again") {
      const { itemHrid, target, protect, catalyst, perItem } = L.loop;
      startLoop({ itemHrid, target, protect, catalyst, perItem });
    } else if (action === "cart") {
      const items = loopCart(L.loop, L.loop.total, (hrid) => heldAt2(hrid, 0)).map((i) => ({ ...i, enhancementLevel: 0 }));
      if (!items.length) return setNotice2("ok", "You already have what the next round takes.");
      try {
        const outcome = await addToCart(L.win, items);
        const parts = [];
        if (outcome.added.length) parts.push(`${outcome.added.length} added`);
        if (outcome.updated.length) parts.push(`${outcome.updated.length} topped up`);
        if (outcome.present.length) parts.push(`${outcome.present.length} already there`);
        if (outcome.failed.length) parts.push(`${outcome.failed.length} failed`);
        setNotice2(outcome.failed.length ? "warn" : "ok", "Shopping cart: " + parts.join(", ") + ".");
      } catch (error) {
        setNotice2("bad", error.message);
      }
    }
  }
  function mountEnhanceLoop(win2) {
    L.win = win2;
    L.root = document.createElement("div");
    L.root.className = "mwia-train mwia-loop mwia-hidden";
    L.root.addEventListener("click", onClick8);
    enableTapTips(L.root);
    document.body.appendChild(L.root);
    L.icon = document.createElement("button");
    L.icon.className = "mwia-launcher mwia-loop-icon mwia-hidden";
    L.icon.setAttribute("aria-label", "Enhance loop");
    L.icon.innerHTML = `\u{1F9EA}<span class="mwia-loop-count"></span>`;
    L.icon.addEventListener("click", () => setMinimized(false));
    document.body.appendChild(L.icon);
    makeDraggable(L.icon, ICON_POSITION_KEY);
    try {
      L.minimized = !!localStorage.getItem(MINIMIZED_KEY);
    } catch {
      L.minimized = false;
    }
    restore2();
    render2();
    onStateChange(onGameMessage2);
    new MutationObserver(() => L.loop && scheduleMark()).observe(document.body, { childList: true, subtree: true });
  }

  // src/trigger-fill.js
  var ROW = '[class*="CombatTriggersSetting_combatTrigger_"]';
  var COMBO = '[role="combobox"]';
  var NATIVE = "input.MuiSelect-nativeInput, input[class*='nativeInput']";
  var VALUE = 'input[type="number"]';
  var LISTBOX = '[role="listbox"]';
  var sleep2 = (ms) => new Promise((resolve2) => setTimeout(resolve2, ms));
  var clean2 = (text) => String(text || "").replace(/\s+/g, " ").trim();
  var isTrigger = (t4) => t4 && typeof t4 === "object" && typeof t4.conditionHrid === "string";
  var holdsTriggers = (v) => Array.isArray(v) && v.every(isTrigger);
  var key = (t4) => [t4.dependencyHrid, t4.conditionHrid, t4.comparatorHrid, Number(t4.value) || 0].join(":");
  var sameTriggers = (a, b) => a.length === b.length && a.every((t4, i) => key(t4) === key(b[i]));
  function settingFiber(box) {
    const host = walkFibers((f) => f.stateNode === box).fiber;
    for (let f = host?.return, i = 0; f && i < 80; f = f.return, i++) {
      const p2 = f.memoizedProps;
      if (typeof f.type !== "string" && p2 && typeof p2 === "object" && typeof p2.updateCombatTriggersHandler === "function" && Object.values(p2).some((v) => Array.isArray(v) && holdsTriggers(v))) return f;
    }
    return null;
  }
  function windowTarget(fiber) {
    const p2 = fiber?.memoizedProps || {};
    const hrid = p2.abilityHrid || p2.itemHrid || Object.values(p2).find((v) => typeof v === "string" && /^\/(abilities|items)\//.test(v));
    return hrid || null;
  }
  function editHook(fiber) {
    const found = [];
    for (let h3 = fiber?.memoizedState, i = 0; h3 && typeof h3 === "object" && "next" in h3 && i < 40; h3 = h3.next, i++) {
      if (Array.isArray(h3.memoizedState) && h3.memoizedState.length > 0 && holdsTriggers(h3.memoizedState) && typeof h3.queue?.dispatch === "function") found.push(h3);
    }
    return found[found.length - 1] || null;
  }
  function shownTriggers(box) {
    return [...box.querySelectorAll(ROW)].map((row) => {
      const natives = [...row.querySelectorAll(NATIVE)].map((input) => input.value);
      const value = row.querySelector(VALUE);
      return { dependencyHrid: natives[0] || "", conditionHrid: natives[1] || "", comparatorHrid: natives[2] || "", value: value ? Number(value.value) || 0 : 0 };
    });
  }
  function shaped(triggers, template) {
    const asString = typeof template?.value === "string";
    return triggers.map((t4) => ({ ...template || {}, dependencyHrid: t4.dependencyHrid, conditionHrid: t4.conditionHrid, comparatorHrid: t4.comparatorHrid, value: asString ? String(t4.value ?? 0) : Number(t4.value ?? 0) }));
  }
  async function fillByState(fiber, triggers) {
    const hook = editHook(fiber);
    if (!hook) return "no state hook with the conditions";
    hook.queue.dispatch(shaped(triggers, hook.memoizedState[0]));
    await sleep2(150);
    return null;
  }
  var button = (box, label3) => [...box.querySelectorAll("button")].find((b) => clean2(b.textContent) === label3);
  async function pick(combo, value) {
    const native = combo.parentElement?.querySelector(NATIVE);
    if (native?.value === value) return true;
    combo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    let option = null;
    for (let i = 0; i < 20 && !option; i++) {
      await sleep2(50);
      option = [...document.querySelectorAll(`${LISTBOX} [data-value]`)].find((o2) => o2.getAttribute("data-value") === value && visible(o2));
    }
    if (!option) {
      for (const list of document.querySelectorAll(LISTBOX)) list.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep2(100);
      if ([...document.querySelectorAll(LISTBOX)].some(visible)) document.querySelector('[class*="MuiBackdrop"]')?.click();
      await sleep2(100);
      return false;
    }
    option.click();
    await sleep2(120);
    return combo.parentElement?.querySelector(NATIVE)?.value === value;
  }
  async function fillByControls(box, triggers) {
    for (let i = 0; i < 6 && box.querySelectorAll(ROW).length < triggers.length; i++) {
      button(box, "+ Condition")?.click();
      await sleep2(120);
    }
    for (let i = 0; i < 6 && box.querySelectorAll(ROW).length > triggers.length; i++) {
      const rows2 = box.querySelectorAll(ROW);
      rows2[rows2.length - 1].querySelector("button")?.click();
      await sleep2(120);
    }
    const rows = [...box.querySelectorAll(ROW)];
    if (rows.length !== triggers.length) return `rows ${rows.length}, wanted ${triggers.length}`;
    for (let i = 0; i < triggers.length; i++) {
      const t4 = triggers[i];
      for (const [k, hrid] of [[0, t4.dependencyHrid], [1, t4.conditionHrid], [2, t4.comparatorHrid]]) {
        const combo = box.querySelectorAll(ROW)[i]?.querySelectorAll(COMBO)[k];
        if (!combo || !await pick(combo, hrid)) return `row ${i + 1}: could not pick ${hrid.split("/").pop()}`;
      }
      const input = box.querySelectorAll(ROW)[i]?.querySelector(VALUE);
      if (input && Number(input.value) !== Number(t4.value)) {
        setReactInput(input, String(t4.value));
        await sleep2(80);
      }
    }
    return null;
  }
  async function fillTriggerWindow(box, fiber, triggers) {
    const steps = [];
    if (fiber) {
      const failed2 = await fillByState(fiber, triggers);
      steps.push(`state: ${failed2 || "set"}`);
      if (!failed2 && sameTriggers(shownTriggers(box), triggers)) return { ok: true, how: "state", diag: steps.join(" \xB7 ") };
      if (!failed2) steps.push(`window shows ${JSON.stringify(shownTriggers(box).map(key))}`);
    } else steps.push("no component found for the window");
    let failed;
    try {
      failed = await fillByControls(box, triggers);
    } catch (error) {
      failed = `controls threw ${error?.message || error}`;
    }
    steps.push(`controls: ${failed || "done"}`);
    const ok = !failed && sameTriggers(shownTriggers(box), triggers);
    if (!ok) steps.push(`window shows ${JSON.stringify(shownTriggers(box).map(key))}, wanted ${JSON.stringify(triggers.map(key))}`);
    return { ok, how: "controls", diag: steps.join(" \xB7 ") };
  }

  // src/trigger-window.js
  var MAX_LINES = 160;
  var clicks = [];
  var attempt2 = (read, fallback = null) => {
    try {
      return read();
    } catch {
      return fallback;
    }
  };
  var clean3 = (text) => String(text || "").replace(/\s+/g, " ").trim();
  var short = (text, n5 = 40) => text.length > n5 ? text.slice(0, n5) + "\u2026" : text;
  function watchTriggerClicks() {
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest(".mwia-panel, .mwia-launcher")) return;
        const chain = [];
        for (let node = target; node && node !== document.body && chain.length < 4; node = node.parentElement) chain.push(describe(node));
        let around = "";
        for (let node = target.parentElement, i = 0; node && i < 4; node = node.parentElement, i++) {
          const ids = iconIds(node).filter(Boolean);
          if (ids.length > iconIds(target).length) {
            around = ids.join("+");
            break;
          }
        }
        clicks.push(`${chain.join(" < ")} {${iconIds(target).join("+")}} around [${around}]`);
        if (clicks.length > 4) clicks.shift();
      },
      true
    );
  }
  function triggerWindow() {
    const title = [...document.querySelectorAll("body *")].find((el) => !el.closest('[class*="mwia"]') && ownText3(el) === "Combat Triggers" && visible(el));
    if (!title) return { title: null, box: null };
    let box = title.parentElement;
    while (box && box !== document.body && ![...box.querySelectorAll("button")].some((b) => clean3(b.textContent) === "Save")) box = box.parentElement;
    return { title, box: box && box !== document.body ? box : title.parentElement };
  }
  function attrs(el) {
    const out = [];
    for (const name of ["role", "type", "aria-haspopup", "aria-expanded", "tabindex", "value", "name"]) {
      const v = el.getAttribute(name);
      if (v !== null) out.push(`${name}=${short(v, 20)}`);
    }
    if (el.tagName === "INPUT" || el.tagName === "SELECT") out.push(`value="${short(String(el.value), 20)}"`);
    return out.length ? ` (${out.join(" ")})` : "";
  }
  function ownText3(el) {
    return clean3([...el.childNodes].filter((n5) => n5.nodeType === 3).map((n5) => n5.textContent).join(" "));
  }
  function outline(root, maxDepth, lines) {
    const walk = (el, depth) => {
      if (lines.length >= MAX_LINES || depth > maxDepth) return;
      const text = ownText3(el);
      const icons = el.tagName.toLowerCase() === "use" ? ` #${(el.getAttribute("href") || el.getAttribute("xlink:href") || "").split("#")[1] || ""}` : "";
      lines.push(`${"  ".repeat(depth)}${describe(el)}${attrs(el)}${text ? ` "${short(text)}"` : ""}${icons}`);
      if (el.tagName === "SELECT") {
        lines.push(`${"  ".repeat(depth + 1)}options: ${[...el.options].map((o2) => `${o2.value}=${short(clean3(o2.textContent), 20)}`).join(" | ")}`);
        return;
      }
      for (const child of el.children) walk(child, depth + 1);
    };
    walk(root, 0);
  }
  var isTrigger2 = (t4) => t4 && typeof t4 === "object" && typeof t4.conditionHrid === "string";
  var holdsTriggers2 = (v) => Array.isArray(v) && v.length > 0 && v.every(isTrigger2);
  var typeName = (f) => attempt2(() => typeof f.type === "string" ? f.type : f.type?.displayName || f.type?.name || "?", "?");
  var valueText = (v) => holdsTriggers2(v) ? JSON.stringify(v.map((t4) => [t4.dependencyHrid, t4.conditionHrid, t4.comparatorHrid, t4.value].map((x) => String(x).split("/").pop()))) : Array.isArray(v) ? `[${v.length}]` : typeof v === "object" && v ? `{${Object.keys(v).slice(0, 8).join(",")}}` : typeof v === "function" ? "fn" : short(String(v), 40);
  var isClass = (f) => !!(f.stateNode && typeof f.stateNode === "object" && !(f.stateNode instanceof Element) && f.stateNode.setState);
  function hookValues(f) {
    const out = [];
    for (let h3 = f.memoizedState, i = 0; h3 && typeof h3 === "object" && "next" in h3 && i < 30; h3 = h3.next, i++) out.push(attempt2(() => h3.memoizedState));
    return out;
  }
  var propsText = (props) => Object.entries(props || {}).filter(([k]) => k !== "children").map(([k, v]) => `${k}=${valueText(v)}`).join("; ");
  function triggerComponents() {
    const found = [];
    walkFibers((f) => {
      if (found.length >= 16) return true;
      const props = f.memoizedProps;
      if (typeof f.type === "string" || !props || typeof props !== "object" || !Object.values(props).some(holdsTriggers2)) return false;
      const fns = Object.entries(props).filter(([, v]) => typeof v === "function").map(([k]) => k);
      const what = props.abilityHrid || props.itemHrid || Object.entries(props).find(([k, v]) => /hrid/i.test(k) && typeof v === "string")?.[1] || "?";
      const triggers = Object.values(props).find(holdsTriggers2);
      found.push(`slot ${typeName(f)}: ${String(what).split("/").pop()} ${Object.entries(props).filter(([k, v]) => /slot|type/i.test(k) && typeof v !== "function" && typeof v !== "object").map(([k, v]) => `${k}=${String(v).split("/").pop()}`).join(" ")} ${valueText(triggers)} fns: ${fns.join(",")}`);
      return false;
    });
    return found;
  }
  function windowFibers(box) {
    const lines = [];
    const host = walkFibers((f) => f.stateNode === box).fiber;
    if (!host) return ["window fiber: not found from the React root"];
    let n5 = 0;
    for (let f = host.return; f && n5 < 14; f = f.return) {
      if (typeof f.type === "string") continue;
      n5++;
      const hooks = hookValues(f);
      lines.push(`up ${n5}: ${typeName(f)}${isClass(f) ? " (class)" : ""}`);
      const props = propsText(f.memoizedProps);
      if (props) lines.push(`  props: ${short(props, 400)}`);
      if (isClass(f)) {
        lines.push(`  state: ${short(Object.entries(f.stateNode.state || {}).map(([k, v]) => `${k}=${valueText(v)}`).join("; "), 400)}`);
        lines.push(`  methods: ${componentMethods(f.stateNode).slice(0, 30).join(", ")}`);
      } else if (hooks.length) {
        lines.push(`  hooks: ${short(hooks.map((v, i) => `${i}:${valueText(v)}`).join("; "), 400)}`);
      }
      if (Object.values(f.memoizedProps || {}).some(holdsTriggers2) && n5 > 2) break;
    }
    for (const el of [box.querySelector("select"), box.querySelector("input"), box.querySelector('[role="button"],[aria-haspopup]')].filter(Boolean)) {
      const fiber = walkFibers((f) => f.stateNode === el).fiber;
      lines.push(`${describe(el)} props: ${fiber ? Object.keys(fiber.memoizedProps || {}).join(",") : "fiber not found"}`);
    }
    return lines;
  }
  function loadoutRows(lines) {
    for (const label3 of ["Abilities", "Consumables"]) {
      const heading = [...document.querySelectorAll("body *")].find((el) => el.children.length === 0 && clean3(el.textContent) === label3 && visible(el) && !el.closest(".mwia-panel"));
      if (!heading) {
        lines.push(`${label3}: heading not found`);
        continue;
      }
      lines.push(`${label3}: heading ${describe(heading)} in ${describe(heading.parentElement)}`);
      const row = heading.nextElementSibling || heading.parentElement?.nextElementSibling;
      if (row) outline(row, 4, lines);
    }
  }
  function triggerWindowReport() {
    const lines = [`world: ${worldReport()}`];
    const { title, box } = triggerWindow();
    if (!box) {
      lines.push("trigger window: not open \u2013 open a loadout's \u2699 under an ability, then tap the button again");
    } else {
      const chain = [];
      for (let node = title; node && node !== document.body && chain.length < 8; node = node.parentElement) chain.push(describe(node));
      lines.push(`trigger window: ${chain.join(" < ")}`);
      outline(box, 12, lines);
      lines.push(...windowFibers(box));
      const setting = settingFiber(box);
      lines.push(`setting component: ${setting ? typeName(setting) : "not found"}, for ${windowTarget(setting) || "?"}`);
      for (let h3 = setting?.memoizedState, i = 0; h3 && typeof h3 === "object" && "next" in h3 && i < 40; h3 = h3.next, i++) {
        lines.push(`  hook ${i}: ${valueText(attempt2(() => h3.memoizedState))}${typeof h3.queue?.dispatch === "function" ? " (dispatch)" : ""}`);
      }
    }
    lines.push(...triggerComponents());
    if (lines.length < MAX_LINES) loadoutRows(lines);
    lines.push(`last clicks: ${clicks.join(" || ") || "none"}`);
    return lines.join("\n");
  }
  function startTriggerWindow(deps) {
    let timer = null;
    const scan10 = () => {
      timer = null;
      const { box } = triggerWindow();
      if (!box || box.querySelector(".mwia-trig-bar")) return;
      const fiber = settingFiber(box);
      const hrid = windowTarget(fiber);
      const advice = hrid ? deps.advice(hrid) : null;
      const bar = document.createElement("div");
      bar.className = "mwia-trig-bar";
      const now2 = shownTriggers(box);
      let line;
      if (!hrid) line = "\u{1F9ED} Can't tell which ability or food this window is for.";
      else if (!advice) line = `\u{1F9ED} ${esc(deps.name(hrid))}: no trigger change in the last Upgrades analysis.`;
      else if (sameTriggers(now2, advice.triggers)) line = `\u{1F9ED} ${esc(deps.name(hrid))}: already as advised.`;
      else line = `\u{1F9ED} Advice for ${esc(deps.name(hrid))}: <b>${esc(deps.describe(advice.triggers))}</b> <button type="button" class="mwia-trig-fill">\u25B6 Fill in</button>`;
      bar.innerHTML = `<div class="mwia-trig-line">${line}</div><div><button type="button" class="mwia-trig-read" title="Read how this window is built, to paste into a chat">\u{1F4CB}</button> <span class="mwia-trig-status"></span></div>`;
      const status2 = (text) => bar.querySelector(".mwia-trig-status").textContent = text;
      bar.querySelector(".mwia-trig-fill")?.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        status2("Filling in\u2026");
        const result = await fillTriggerWindow(box, settingFiber(box) || fiber, advice.triggers);
        if (result.ok) {
          status2("Filled in \u2013 check it and tap Save.");
        } else {
          status2("Couldn't fill it in \u2013 the details are under \u{1F9ED} Upgrades.");
          deps.onReport(`fill in ${hrid}: ${result.diag}
${triggerWindowReport()}`, false);
        }
      });
      bar.querySelector(".mwia-trig-read").addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const report = triggerWindowReport();
        let copied = false;
        try {
          await navigator.clipboard.writeText(report);
          copied = true;
        } catch {
        }
        status2(copied ? "Copied \u2013 paste it in the chat." : "Not copied \u2013 open \u{1F9ED} Upgrades and tap \u{1F4CB} Copy.");
        deps.onReport(report, copied);
      });
      box.prepend(bar);
    };
    new MutationObserver((records) => {
      if (timer || records.every((r) => r.target.closest?.(".mwia-trig-bar"))) return;
      timer = setTimeout(scan10, 200);
    }).observe(document.body, { childList: true, subtree: true });
  }

  // src/listing-price.js
  var WALL_SHARE = 0.2;
  function otherLevels(levels, own = [], range = null, side = "sell") {
    const mine2 = /* @__PURE__ */ new Map();
    for (const listing of own) mine2.set(listing.price, (mine2.get(listing.price) || 0) + listing.quantity);
    return levels.map((level) => ({ price: level.price, quantity: level.quantity - (mine2.get(level.price) || 0) })).filter((level) => level.quantity > 0 && (!range || level.price >= range.min && level.price <= range.max)).sort((a, b) => side === "sell" ? a.price - b.price : b.price - a.price);
  }
  function findWall(levels) {
    const total = levels.reduce((sum, level) => sum + level.quantity, 0);
    let ahead = 0;
    for (const level of levels) {
      if (total > 0 && level.quantity >= WALL_SHARE * total) return { price: level.price, quantity: level.quantity, ahead, total };
      ahead += level.quantity;
    }
    return null;
  }
  function standing(price, levels, side = "sell") {
    let better2 = 0;
    let same2 = 0;
    for (const level of levels) {
      if (level.price === price) same2 += level.quantity;
      else if (side === "sell" ? level.price < price : level.price > price) better2 += level.quantity;
    }
    return { better: better2, same: same2 };
  }
  var HORIZONS = [1, 8, 24];
  var CONFIDENCE = 0.7;
  var FILLED = 0.7;
  var COVERAGE = 0.5;
  var MIN_WINDOWS = 12;
  var USUAL_TOP = 0.9;
  function takenPerHour(hours, side = "sell") {
    const sold = hours.filter((r) => r.sold);
    if (sold.length < MIN_HOURS) return null;
    const count3 = (r) => Number.isFinite(r.v) ? r.v : 0;
    const cap3 = SPIKE * (median(sold.filter((r) => count3(r) > 0).map((r) => [count3(r), 1])) ?? 0);
    let taken = 0;
    for (const r of sold) {
      const askShare = r.a > r.b && Number.isFinite(r.p) ? Math.min(1, Math.max(0, (r.p - r.b) / (r.a - r.b))) : 0.5;
      taken += Math.min(count3(r), cap3) * (side === "sell" ? askShare : 1 - askShare);
    }
    return { hours: sold.length, perHour: taken / sold.length };
  }
  function horizonPrice({ side, hours, horizon, quantity = 1, best = null, levels = [], range = null, taken = null }) {
    const sell = side === "sell";
    const key2 = sell ? "a" : "b";
    const need = taken?.perHour > 0 ? FILLED * quantity / taken.perHour : 0;
    if (need > horizon) return { price: null, why: "quantity", need };
    const byHour = new Map(hours.map((r) => [r.hour, r[key2]]));
    const newest = hours.length ? hours[hours.length - 1].hour : 0;
    const starts = hours.filter((r) => r.hour + horizon <= newest).map((r) => r.hour);
    const windows = [];
    for (const start2 of starts) {
      const seen = [];
      for (let k = 1; k <= horizon; k++) if (byHour.has(start2 + k)) seen.push([k, byHour.get(start2 + k)]);
      if (seen.length >= Math.max(1, COVERAGE * horizon)) windows.push(seen);
    }
    if (windows.length < MIN_WINDOWS) return { price: null, why: "history", windows: windows.length };
    const better2 = (x, y) => sell ? x < y : x > y;
    const inRange = (price) => !range || price >= range.min && price <= range.max;
    const prices2 = new Set([...hours.map((r) => r[key2]), ...levels.map((level) => level.price)].filter((p2) => p2 > 0 && inRange(p2)));
    const sorted = [...prices2].sort((x, y) => x - y);
    const gap = Math.min(...sorted.slice(1).map((price, i) => price - sorted[i]));
    const past = best > 0 && Number.isFinite(gap) ? sell ? best - gap : best + gap : best;
    const candidates = [...prices2].map((price) => ({ price, under: false }));
    if (best > 0 && inRange(past)) candidates.push({ price: best, under: true });
    const rank = (c2) => sell ? c2.price - (c2.under ? 0.5 : 0) : -(c2.price + (c2.under ? 0.5 : 0));
    candidates.sort((x, y) => rank(y) - rank(x));
    const top = quantile(hours.map((r) => [r[key2], 1]), sell ? USUAL_TOP : 1 - USUAL_TOP);
    const usual = (price) => top === null || !better2(top, price);
    for (const c2 of candidates) {
      const firstNow = best > 0 && (c2.under ? usual(past) : better2(c2.price, best) && usual(c2.price));
      let sold = 0;
      for (const seen of windows) {
        let front = 0;
        for (const [k, other] of seen) {
          const value = !Number.isFinite(other) ? 1 : c2.under ? better2(other, c2.price) ? 0 : 1 : better2(other, c2.price) ? 0 : other === c2.price ? 0.5 : 1;
          front += firstNow && k === 1 ? 1 : value;
        }
        front *= horizon / seen.length;
        if (firstNow && seen[0][0] !== 1) front = Math.min(horizon, front + 1);
        if (front > 0 && front >= need) sold++;
      }
      const chance = sold / windows.length;
      if (chance >= CONFIDENCE) return { price: c2.price, under: c2.under, chance, windows: windows.length, need };
    }
    return { price: null, why: "none", windows: windows.length, need };
  }
  function listingPrices({ side, book = null, own = [], best = null, range = null, summary: summary2 = null, hours = [], quantity = 1 }) {
    const sell = side === "sell";
    const levels = otherLevels(book ? sell ? book.asks : book.bids : [], own, range, side);
    const clamp = (price) => {
      if (range && price > range.max) return { price: range.max, capped: "max" };
      if (range && price < range.min) return { price: range.min, capped: "min" };
      return { price, capped: null };
    };
    const out = [];
    if (best > 0) out.push({ kind: "match", ...clamp(best), step: 0 });
    const wall = findWall(levels);
    if (wall) out.push({ kind: "wall", price: wall.price, capped: null, step: sell ? -1 : 1, wall });
    const othersBest = book ? levels[0]?.price ?? null : best;
    const taken = takenPerHour(hours, side);
    for (const horizon of HORIZONS) {
      const h3 = horizonPrice({ side, hours, horizon, quantity, best: othersBest, levels, range, taken });
      out.push({ kind: "horizon", horizon, ...h3, capped: null, step: h3.under ? sell ? -1 : 1 : 0 });
    }
    const history = summary2 && summary2.hours7 >= MIN_HOURS ? summary2[sell ? "a" : "b"] : null;
    return { levels, suggestions: out, usual: history?.med7 ?? null, hours: summary2?.hours7 ?? 0, taken, quantity };
  }

  // src/market.js
  var MARKET_RULES = {
    // An order is behind a wall when more than this many days of sales come first…
    daysAhead: 1,
    // …or, while how many sell a day is unknown, this share of everything others
    // offer comes first (the same share as the Wall price button). A thin book
    // makes the share big however quickly those sell, so sales come first.
    wallShare: WALL_SHARE,
    // Without an order book: a best price this much better than yours is a wall too.
    bigGap: 0.1,
    // An order book seen on the market within this many hours counts as fresh.
    bookHours: 6,
    // No sale (or purchase) for this long: the order is stale.
    staleHours: 12,
    // Inventory worth less than this in total is listed only under "Show all".
    minValue: 1e4,
    // Selling at the bid loses little when the spread is within this share of the ask.
    quickSpread: 0.05
  };
  var HOUR = 36e5;
  var remaining = (listing) => Math.max(0, (Number(listing.orderQuantity) || 0) - (Number(listing.filledQuantity) || 0));
  function placedAt(listing) {
    const raw = listing.createdTimestamp ?? listing.createdAt ?? listing.created;
    const time2 = typeof raw === "number" ? raw < 1e12 ? raw * 1e3 : raw : Date.parse(raw ?? "");
    return Number.isFinite(time2) ? time2 : null;
  }
  function trackFills(listings, store5 = {}, now2 = Date.now()) {
    const out = {};
    for (const listing of listings) {
      if (listing.id === void 0 || listing.id === null) continue;
      const filled = Number(listing.filledQuantity) || 0;
      const before = store5[listing.id];
      if (!before) out[listing.id] = { filled, at: Math.min(now2, placedAt(listing) ?? now2) };
      else out[listing.id] = before.filled === filled ? before : { filled, at: now2 };
    }
    return out;
  }
  function listingStatus(listing, { entry = null, book = null, own = [], summary: summary2 = null, lastFillAt = null, now: now2 = Date.now(), rules = MARKET_RULES } = {}) {
    const sell = !!listing.isSell;
    const side = sell ? "sell" : "buy";
    const price = Number(listing.price) || 0;
    const sold = summary2?.liquidity?.sold;
    const perDay2 = sold?.enough && sold.perDay > 0 ? sold.perDay : null;
    const out = { side, price, left: remaining(listing), kind: "unknown", alert: false, fromBook: false, better: null, total: null, share: null, daysAhead: null, gap: null, best: null, perDay: perDay2 };
    const better2 = (a, b) => sell ? a < b : a > b;
    if (book && now2 - book.at <= rules.bookHours * HOUR) {
      const levels = otherLevels(sell ? book.asks : book.bids, own, book.range, side);
      const { better: ahead, same: same2 } = standing(price, levels, side);
      const total = levels.reduce((sum, level) => sum + level.quantity, 0);
      Object.assign(out, { fromBook: true, better: ahead, total, share: total ? ahead / total : 0, daysAhead: perDay2 ? ahead / perDay2 : null, best: levels[0]?.price ?? null, bookAt: book.at });
      if (ahead === 0) out.kind = same2 ? "tied" : "front";
      else {
        const wall = out.daysAhead !== null ? out.daysAhead > rules.daysAhead : out.share >= rules.wallShare;
        out.kind = wall ? "wall" : "behind";
        out.gap = out.best ? Math.abs(out.best / price - 1) : null;
      }
    } else {
      const best = sell ? entry?.a : entry?.b;
      if (best > 0) {
        out.best = best;
        if (!better2(best, price)) out.kind = "front";
        else {
          out.kind = "cheaper";
          out.gap = Math.abs(best / price - 1);
        }
      }
    }
    out.alert = out.kind === "wall" || out.kind === "cheaper" && out.gap > rules.bigGap;
    out.stale = lastFillAt !== null && now2 - lastFillAt > rules.staleHours * HOUR;
    out.idleHours = lastFillAt !== null ? (now2 - lastFillAt) / HOUR : null;
    const usual = summary2 && summary2.hours7 >= MIN_HOURS ? summary2[sell ? "a" : "b"].med7 : null;
    const vs = versusUsual(price, usual);
    out.usual = usual;
    out.vsUsual = vs;
    out.generous = !!vs && (sell ? vs.label === "below" : vs.label === "above");
    return out;
  }
  function sellSuggestions(items, { data, entryOf, summaryOf = () => null, reserved = /* @__PURE__ */ new Map(), keep: keep2 = /* @__PURE__ */ new Set(), listed = () => 0, rules = MARKET_RULES }) {
    const rows = [];
    const kept2 = [];
    for (const { hrid, level = 0, count: count3 } of items) {
      const item = data.itemDetailMap[hrid];
      if (hrid === "/items/coin" || !item || !(count3 > 0)) continue;
      const key2 = keepKey(hrid, level);
      if (keep2.has(key2)) {
        kept2.push({ hrid, level, count: count3, why: "pinned" });
        continue;
      }
      if (reserved.has(hrid)) {
        kept2.push({ hrid, level, count: count3, why: reserved.get(hrid) });
        continue;
      }
      if (!item.isTradable) continue;
      const entry = entryOf(hrid, level) || {};
      const ask = entry.a > 0 ? entry.a : null;
      const bid = entry.b > 0 ? entry.b : null;
      if (!ask && !bid) continue;
      const summary2 = summaryOf(hrid, level);
      const history = summary2 && summary2.hours7 >= MIN_HOURS;
      const usualAsk = history ? summary2.a.med7 : null;
      const usualBid = history ? summary2.b.med7 : null;
      const ceiling = usualAsk > 0 ? usualAsk : bid ? WIDE_SPREAD * bid : Infinity;
      const listPrice = ask ? Math.min(ask, ceiling) : usualAsk > 0 ? usualAsk : null;
      const net = (price) => price ? price * count3 * (1 - MARKET_TAX) : 0;
      const spread = ask && bid ? (ask - bid) / ask : null;
      const how = !bid ? "list" : !listPrice ? "sell" : spread !== null && spread <= rules.quickSpread ? "sell" : "list";
      const sold = summary2?.liquidity?.sold;
      const perDay2 = sold?.enough && sold.perDay > 0 ? sold.perDay : null;
      rows.push({
        hrid,
        level,
        count: count3,
        ask,
        bid,
        listPrice,
        spread,
        how,
        nowValue: net(bid),
        listValue: net(listPrice),
        value: Math.max(net(bid), net(listPrice)),
        // Buyers paying well above their usual bid: a good moment. An ask well below usual: waiting may pay.
        bidVsUsual: versusUsual(bid, usualBid),
        askVsUsual: versusUsual(ask, usualAsk),
        perDay: perDay2,
        daysToSell: perDay2 ? count3 / perDay2 : null,
        listed: listed(hrid, level),
        equipment: !!item.equipmentDetail,
        small: Math.max(net(bid), net(listPrice)) < rules.minValue
      });
    }
    rows.sort((a, b) => b.value - a.value);
    return { rows, kept: kept2 };
  }
  var keepKey = (hrid, level = 0) => `${hrid}#${level}`;
  function reservedItems(character, items, data, trainActions = []) {
    const reserved = /* @__PURE__ */ new Map();
    const add = (hrid, why) => hrid && !reserved.has(hrid) && reserved.set(hrid, why);
    for (const map of [character.actionTypeDrinkSlotsMap, character.actionTypeFoodSlotsMap]) {
      for (const slots of Object.values(map || {})) for (const slot of slots || []) add(slot?.itemHrid, "in your slots");
    }
    const byHash = /* @__PURE__ */ new Map();
    for (const item of items.values()) if (item.hash) byHash.set(item.hash, item.itemHrid);
    const actionInputs = (actionHrid, why) => {
      const action = data.actionDetailMap?.[actionHrid];
      for (const input of action?.inputItems || []) add(input.itemHrid, why);
      add(action?.upgradeItemHrid, why);
    };
    for (const queued of character.characterActions || []) {
      actionInputs(queued.actionHrid, "for your queue");
      for (const hash2 of [queued.primaryItemHash, queued.secondaryItemHash]) {
        const hrid = byHash.get(hash2) || (typeof hash2 === "string" ? hash2.split("::")[2] : null);
        if (!hrid) continue;
        add(hrid, "for your queue");
        if (queued.actionHrid?.includes("enhanc")) for (const cost of data.itemDetailMap[hrid]?.enhancementCosts || []) add(cost.itemHrid, "for your queue");
      }
    }
    for (const actionHrid of trainActions) actionInputs(actionHrid, "for your train");
    return reserved;
  }

  // src/market-ui.js
  var KEEP_KEY = "mwia-keep";
  var FILLS_KEY = "mwia-listing-fills";
  var INVENTORY8 = "/item_locations/inventory";
  var view2 = { showAll: false };
  var dec2 = (n5, d = 1) => n5.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  var coins7 = (n5) => (n5 < 0 ? "\u2212" : "") + shortCoins(Math.abs(n5));
  var pctAbs = (fraction) => `${dec2(Math.abs(fraction) * 100, fraction && Math.abs(fraction) < 0.1 ? 1 : 0)}%`;
  var label = (hrid, level) => esc(itemName(hrid)) + (level ? ` <span class="mwia-enh">+${level}</span>` : "");
  function readJson2(key2, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key2) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }
  function writeJson2(key2, value) {
    try {
      localStorage.setItem(key2, JSON.stringify(value));
    } catch {
    }
  }
  var keepSet = () => new Set(readJson2(KEEP_KEY, []));
  function toggleKeep(hrid, level) {
    const keep2 = keepSet();
    const key2 = keepKey(hrid, Number(level) || 0);
    if (keep2.has(key2)) keep2.delete(key2);
    else keep2.add(key2);
    writeJson2(KEEP_KEY, [...keep2]);
  }
  function toggleShowAllMarket() {
    view2.showAll = !view2.showAll;
  }
  var openListings = () => (state.character?.myMarketListings || []).filter((listing) => remaining(listing) > 0);
  function listingStatuses(now2 = Date.now()) {
    const listings = openListings();
    const fills = trackFills(listings, readJson2(FILLS_KEY, {}), now2);
    writeJson2(FILLS_KEY, fills);
    return listings.map((listing) => {
      const level = Number(listing.enhancementLevel) || 0;
      const own = listings.filter((other) => other.itemHrid === listing.itemHrid && (Number(other.enhancementLevel) || 0) === level && !!other.isSell === !!listing.isSell).map((other) => ({ price: Number(other.price) || 0, quantity: remaining(other) }));
      const status2 = listingStatus(listing, {
        entry: marketEntry(listing.itemHrid, level),
        book: orderBookAt(listing.itemHrid, level),
        own,
        summary: priceSummary(listing.itemHrid, level),
        lastFillAt: fills[listing.id]?.at ?? null,
        now: now2
      });
      return { listing, level, ...status2 };
    });
  }
  function marketAlerts() {
    if (!state.character || !getClientData()) return 0;
    try {
      return listingStatuses().filter((s2) => s2.alert).length;
    } catch {
      return 0;
    }
  }
  function salesTime(days) {
    if (days >= 1) return `${dec2(days, days < 10 ? 1 : 0)} days`;
    const hours = days * 24;
    return hours < 0.1 ? "minutes" : `${dec2(hours, hours < 10 ? 1 : 0)} h`;
  }
  function statusText(s2) {
    const days = s2.daysAhead !== null ? ` \u2013 about ${salesTime(s2.daysAhead)} of sales` : "";
    switch (s2.kind) {
      case "front":
        return `<span class="mwia-ok">\u2705 first in line</span>${s2.fromBook ? "" : ` <span class="mwia-dim">(or sharing the price)</span>`}`;
      case "tied":
        return `<span class="mwia-ok">\u2705 first, sharing the price</span>`;
      case "behind":
        return `<span class="mwia-dim">${s2.better.toLocaleString("en-US")} ${s2.side === "sell" ? "cheaper" : "higher"} first (${pctAbs(s2.share)} of the offer)${days}</span>`;
      case "wall":
        return `<span class="mwia-bad">\u26D4 ${s2.better.toLocaleString("en-US")} ${s2.side === "sell" ? "cheaper" : "higher"} first \u2013 ${pctAbs(s2.share)} of the offer${days}</span>`;
      case "cheaper":
        return `<span class="${s2.alert ? "mwia-bad" : "mwia-warn"}">\u26A0 ${s2.side === "sell" ? "cheaper" : "higher"} offer at ${coins7(s2.best)} (${s2.side === "sell" ? "\u2212" : "+"}${pctAbs(s2.gap)})</span>
              <span class="mwia-dim">\u2013 open it on the market to see how many</span>`;
      default:
        return `<span class="mwia-dim">no price in the market file</span>`;
    }
  }
  function listingRow(s2) {
    const { listing, level } = s2;
    const notes = [];
    if (s2.stale) notes.push(`<span class="mwia-warn" title="No ${s2.side === "sell" ? "sale" : "purchase"} on this order for ${dec2(s2.idleHours, 0)} h">\u{1F4A4} ${dec2(s2.idleHours, 0)} h</span>`);
    if (s2.generous) {
      notes.push(`<span class="mwia-warn" title="The week's usual ${s2.side === "sell" ? "ask" : "bid"} is ${coins7(s2.usual)}">${s2.side === "sell" ? "\u2193 " + pctAbs(s2.vsUsual.diff) + " below" : "\u2191 " + pctAbs(s2.vsUsual.diff) + " above"} usual</span>`);
    }
    if (s2.fromBook) notes.push(`<span class="mwia-dim">order book ${dec2((Date.now() - s2.bookAt) / 36e5, 1)} h old</span>`);
    return `<tr class="${s2.alert ? "mwia-alert-row" : ""}"><td>${s2.side === "sell" ? "Sell" : "Buy"}</td><td>${label(listing.itemHrid, level)}</td>
      <td class="mwia-num">${s2.left.toLocaleString("en-US")}</td><td class="mwia-num">${coins7(s2.price)}</td><td>${statusText(s2)} ${notes.join(" ")}</td>
      <td><button class="mwia-cart-btn" data-action="market-open" data-item="${esc(listing.itemHrid)}" data-level="${level}" title="Open on the market (reads its order book)">\u{1F3EA}</button></td></tr>`;
  }
  function inventoryItems() {
    const counts = /* @__PURE__ */ new Map();
    for (const item of state.items.values()) {
      if (item.itemLocationHrid !== INVENTORY8 || !item.itemHrid) continue;
      const level = Number(item.enhancementLevel) || 0;
      const key2 = keepKey(item.itemHrid, level);
      const entry = counts.get(key2) || { hrid: item.itemHrid, level, count: 0 };
      entry.count += Number(item.count) || 0;
      counts.set(key2, entry);
    }
    return [...counts.values()];
  }
  function sellRow(r) {
    const notes = [];
    if (r.bidVsUsual?.label === "above") notes.push(`<span class="mwia-ok">buyers pay ${pctAbs(r.bidVsUsual.diff)} above usual \u2013 a good moment</span>`);
    if (r.askVsUsual?.label === "below") notes.push(`<span class="mwia-warn">price ${pctAbs(r.askVsUsual.diff)} below usual \u2013 waiting may pay</span>`);
    if (r.daysToSell > 1) notes.push(`<span class="mwia-warn">${dec2(r.daysToSell, 1)} days of sales</span>`);
    if (!r.bid) notes.push(`<span class="mwia-dim">nobody buys now</span>`);
    if (r.listed) notes.push(`<span class="mwia-dim">${r.listed.toLocaleString("en-US")} already listed</span>`);
    if (r.equipment) notes.push(`<span class="mwia-dim">equipment</span>`);
    const how = r.how === "sell" ? `<b>Sell now</b> at ${coins7(r.bid)}${r.spread !== null ? ` <span class="mwia-dim">(listing gains only ${pctAbs(r.spread)})</span>` : ""}` : `<b>List</b> at ${coins7(r.listPrice)}${r.bid ? ` <span class="mwia-dim">(now: ${coins7(r.bid)})</span>` : ""}`;
    return `<tr class="${r.small ? "mwia-faded" : ""}"><td>${label(r.hrid, r.level)}</td><td class="mwia-num">${r.count.toLocaleString("en-US")}</td>
      <td class="mwia-num">${coins7(r.value)}</td><td>${how}${notes.length ? "<br>" + notes.join(" \xB7 ") : ""}</td>
      <td><button class="mwia-cart-btn" data-action="market-open" data-item="${esc(r.hrid)}" data-level="${r.level}" title="Open on the market">\u{1F3EA}</button>
        <button class="mwia-cart-btn" data-action="market-keep" data-item="${esc(r.hrid)}" data-level="${r.level}" title="Keep it: never suggest selling it">\u{1F4CC}</button></td></tr>`;
  }
  var WHY = { pinned: "\u{1F4CC} pinned", "in your slots": "in your slots", "for your queue": "for your queue", "for your train": "for your train" };
  function renderMarket() {
    const data = getClientData();
    if (!state.character || !data) return `<p>Waiting for the game and the market prices\u2026</p>`;
    let html = `<h3>\u{1F4E4} Your orders</h3>`;
    const statuses = listingStatuses();
    if (!statuses.length) {
      html += `<p class="mwia-dim">No open orders.</p>`;
    } else {
      const order = { wall: 0, cheaper: 1, behind: 2, unknown: 3, tied: 4, front: 5 };
      statuses.sort((a, b) => b.alert - a.alert || order[a.kind] - order[b.kind] || b.stale - a.stale);
      const alerts = statuses.filter((s2) => s2.alert).length;
      if (alerts) html += `<p class="mwia-reco">\u26D4 ${alerts} order${alerts === 1 ? " is" : "s are"} behind a pile of better offers \u2013 unlikely to fill soon. Open ${alerts === 1 ? "it" : "them"} with \u{1F3EA} and pick a new price (the <b>Wall</b> button stops just in front of the pile).</p>`;
      html += `<table class="mwia-table mwia-wide"><thead><tr><th>Side</th><th>Item</th><th class="mwia-num">Left</th><th class="mwia-num">Price</th><th>Standing</th><th></th></tr></thead>
          <tbody>${statuses.map(listingRow).join("")}</tbody></table>
          <p class="mwia-dim">\u26D4 when more than ${MARKET_RULES.daysAhead} day of sales comes before your order (or, until the price history knows how many sell a day,
          at least ${pctAbs(MARKET_RULES.wallShare)} of what others offer) \u2013 from the order book, read when you open the item on the market, fresh for ${MARKET_RULES.bookHours} h; or without one when the best offer is more than
          ${pctAbs(MARKET_RULES.bigGap)} better than yours. \u{1F4A4} = nothing ${"sold or bought"} for ${MARKET_RULES.staleHours} h. Prices from the market file (refreshed every 10 min while you have orders).</p>`;
    }
    const trainActions = (() => {
      try {
        return trainActionsLeft();
      } catch {
        return [];
      }
    })();
    const { rows, kept: kept2 } = sellSuggestions(inventoryItems(), {
      data,
      entryOf: marketEntry,
      summaryOf: priceSummary,
      reserved: reservedItems(state.character, state.items, data, trainActions),
      keep: keepSet(),
      listed: (hrid, level) => openListings().filter((l2) => l2.isSell && l2.itemHrid === hrid && (Number(l2.enhancementLevel) || 0) === level).reduce((sum, l2) => sum + remaining(l2), 0)
    });
    html += `<h3>\u{1F4B0} Sell from your inventory</h3>`;
    const shown = view2.showAll ? rows : rows.filter((r) => !r.small);
    if (!shown.length) html += `<p class="mwia-dim">Nothing worth ${coins7(MARKET_RULES.minValue)} or more to sell.</p>`;
    else {
      html += `<table class="mwia-table mwia-wide"><thead><tr><th>Item</th><th class="mwia-num">Have</th><th class="mwia-num" title="After the 4% market tax">Worth</th><th>Advice</th><th></th></tr></thead>
          <tbody>${shown.map(sellRow).join("")}</tbody></table>`;
    }
    const hidden = rows.length - shown.length;
    html += `<p><button class="mwia-link" data-action="market-all">${view2.showAll ? "Hide small amounts" : `Show all${hidden ? ` (${hidden} under ${coins7(MARKET_RULES.minValue)})` : ""}`}</button></p>`;
    if (kept2.length) {
      html += `<details class="mwia-skill-sec"><summary>Kept, not offered (${kept2.length})</summary><ul>${kept2.map((k) => `<li>${label(k.hrid, k.level)} \xD7 ${k.count.toLocaleString("en-US")} \u2013 ${esc(WHY[k.why] || k.why)}${k.why === "pinned" ? ` <button class="mwia-link" data-action="market-keep" data-item="${esc(k.hrid)}" data-level="${k.level}">unpin</button>` : ""}</li>`).join("")}</ul></details>`;
    }
    html += `<p class="mwia-dim"><b>Sell now</b> when listing would gain under ${pctAbs(MARKET_RULES.quickSpread)}; else <b>List</b> at the lowest ask, never above the week's usual ask.
      Teas, food and drinks in your slots, materials for your queue or a running train, and what you pin \u{1F4CC} are never offered.</p>`;
    return html;
  }

  // src/labyrinth-ui.js
  var cap2 = (s2) => s2 ? s2[0].toUpperCase() + s2.slice(1) : "";
  var pctText = (x) => `${Math.round(100 * x)}%`;
  var lvl = (x) => x === null || x === void 0 ? "\u2013" : String(Math.round(x));
  var FLOORS = 10;
  var roomLevelSetting = (settings2) => Math.max(1, Math.min(300, Math.round(Number(settings2.labyLevel) || FLOOR_ONE_LEVEL)));
  var buildStyleSetting = (settings2) => ATTACK_STYLES.includes(settings2.labyStyle) ? settings2.labyStyle : "ranged";
  function crateSelect(settings2, kind, slotted) {
    const key2 = kind === "coffee" ? "labyCoffee" : "labyFood";
    const value = settings2[key2] || "slots";
    const options = [["slots", `Your Labyrinth slots (${slotted ? cap2(slotted) : "none"})`], ["none", "None"], ...CRATE_TIERS.map((t4) => [t4, cap2(t4)])];
    return `<label title="Opened when you enter the Labyrinth; its buffs last the whole run">${CRATE_KINDS[kind]}
      <select data-setting="${key2}">${options.map(([k, v]) => `<option value="${k}" ${value === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`;
  }
  function floorSelect(level) {
    const options = Array.from({ length: FLOORS }, (_, i) => i + 1).map((f) => `<option value="${f}" ${floorLevel(f) === level ? "selected" : ""}>Floor ${f} (\u2248 level ${floorLevel(f)})</option>`);
    const custom = !options.some((o2) => o2.includes("selected"));
    return `<label title="Roughly: floor 1 at room level ${FLOOR_ONE_LEVEL} and about ${FLOOR_STEP} levels more per floor (in the game floor 1 had rooms at 23\u201340, floor 2 at 57\u201360). Type the room level the game shows for a room.">Floor
      <select data-setting="labyFloor">${custom ? `<option selected value="">Room level ${level}</option>` : ""}${options.join("")}</select></label>`;
  }
  var floorText = (level) => level === null ? "" : floorAt(level) ? ` <span class="mwia-dim">(fl. ${floorAt(level)})</span>` : ` <span class="mwia-dim">(below fl. 1)</span>`;
  function verdict2(win2, point) {
    if (win2 === null) return "\u2013";
    if (win2 >= SAFE_WIN) return `<span class="mwia-ok" title="You win ${pctText(win2)} of these rooms">\u2705 fight \xB7 ${pctText(win2)}</span>`;
    const dies = point && point.deaths >= point.timeouts;
    const why = point ? dies ? " \xB7 you die" : " \xB7 too slow" : "";
    const title = point ? dies ? "Most lost rooms end with you dead" : "Most lost rooms end when the 2 minutes run out: more damage needed" : "";
    if (win2 >= RISKY_WIN) return `<span class="mwia-warn" title="${title}">\u26A0 risky \xB7 ${pctText(win2)}${why}</span>`;
    return `<span class="mwia-bad" title="${title}">\u2716 shroud or go around \xB7 ${pctText(win2)}${why}</span>`;
  }
  function weakText(data, hrid) {
    const weak = weakTo(data, hrid);
    if (weak.thorns) return `<span title="It dodges every style and attacks very fast: the wiki says damage back when it hits you beats it">Thorns / Retaliation</span>`;
    return weak.styles.map((s2) => s2.types.length === 1 && s2.types[0] === "physical" ? cap2(s2.style) : `${cap2(s2.style)} <span class="mwia-dim">(${s2.types.join(", ")})</span>`).join(" \xB7 ");
  }
  function matchHtml(profile, data, hrid) {
    const m2 = profile && yourMatch(profile, data, hrid);
    if (!m2) return "\u2013";
    const what = m2.what.startsWith("/abilities/") ? abilityName(m2.what) : m2.what.startsWith("/items/") ? itemName(m2.what) : m2.what;
    const label3 = `${cap2(m2.style)} \xB7 ${m2.type}`;
    if (m2.share >= 0.5) return `<span class="mwia-ok" title="Your best hit against it: ${esc(what)}">${label3} \u2713</span>`;
    return `<span class="mwia-bad" title="Your best hit (${esc(what)}) does about ${Math.max(1, Math.round(1 / Math.max(1e-3, m2.share)))}\xD7 worse than its weakness">${label3} \u2717</span>`;
  }
  function roomGuide(lab, data, level) {
    const tiles = lab.monsters.map((m2) => {
      const win2 = winAt(m2.curve, level);
      const kind = win2 >= SAFE_WIN ? "ok" : win2 >= RISKY_WIN ? "warn" : "bad";
      const action = kind === "bad" ? "Shroud or go around" : esc(m2.setupName);
      const reach = m2.safe === null ? "never safe" : floorAt(m2.safe) ? `safe to floor ${floorAt(m2.safe)}` : `safe to level ${lvl(m2.safe)}`;
      return `<div class="mwia-laby-tile mwia-laby-${kind}" title="${esc(monsterName(m2.hrid))}: ${pctText(win2)} of the rooms won at room level ${level} with ${esc(m2.setupName)}">
          <div class="mwia-laby-tile-name">${esc(monsterName(m2.hrid))}</div>
          <div class="mwia-laby-tile-action">${kind === "bad" ? "\u2716" : kind === "warn" ? "\u26A0" : "\u2705"} ${action}</div>
          <div class="mwia-dim">${kind === "bad" ? `best: ${esc(m2.setupName)} \xB7 ` : ""}${pctText(win2)} \xB7 ${reach}</div></div>`;
    });
    return `<div class="mwia-laby-guide">${tiles.join("")}</div>`;
  }
  function summaryHtml2(lab, level) {
    const groups = { fight: [], risky: [], skip: [] };
    for (const m2 of lab.monsters) {
      const win2 = winAt(m2.curve, level);
      (win2 >= SAFE_WIN ? groups.fight : win2 >= RISKY_WIN ? groups.risky : groups.skip).push(esc(monsterName(m2.hrid)));
    }
    const line = (label3, list, cls) => list.length ? `<br><span class="${cls}">${label3}</span> ${list.join(", ")}` : "";
    const floor = floorAt(level) && floorLevel(floorAt(level)) === level ? ` (floor ${floorAt(level)}, roughly)` : "";
    return `<div class="mwia-reco"><b>At room level ${level}${floor}</b>, each room type with its best loadout:
      ${line("\u2705 Fight:", groups.fight, "mwia-ok")}${line("\u26A0 Risky:", groups.risky, "mwia-warn")}${line("\u2716 Shroud or go around:", groups.skip, "mwia-bad")}
      ${groups.fight.length === lab.monsters.length ? "<br>You win every room type here safely \u2013 try a deeper floor." : ""}</div>`;
  }
  function monsterTable(lab, profileOf, data, level, improve) {
    const swaps = improve ? bestSwaps(improve) : /* @__PURE__ */ new Map();
    const several = lab.setups.length > 1;
    let html = `<table class="mwia-table mwia-wide mwia-laby-rooms"><thead><tr><th>Monster</th><th title="Its attack style and damage type">Attacks with</th>
      <th title="The attack styles (and damage types) that hurt it most: the styles it hardly dodges and what its resistances let through">Weak to</th>
      ${several ? `<th title="Your saved loadout that goes furthest against it \u2013 set it for this room type in the game's Labyrinth automation">Loadout</th>` : ""}
      <th title="That loadout's best way of hitting it: \u2713 when it is (close to) its weakness">Your hit</th>
      <th class="mwia-num" title="Highest room level where you win at least ${pctText(SAFE_WIN)} of the rooms (the floor is rough)">Safe up to</th>
      <th class="mwia-num" title="Room level where you win half the rooms">50% at</th>
      <th>At level ${level}</th><th class="mwia-num" title="Typical time to win a room at this level (the limit is 2 minutes)">Win time</th>
      ${improve ? "<th>Better with</th>" : ""}</tr></thead><tbody>`;
    for (const m2 of lab.monsters) {
      const attack = monsterAttack(data, m2.hrid);
      const point = nearestPoint(m2.curve, level);
      const time2 = point?.medianWinSeconds;
      html += `<tr><td>${esc(monsterName(m2.hrid))}</td><td>${cap2(attack.style)} \xB7 ${attack.type}</td><td><span>${weakText(data, m2.hrid)}</span></td>
          ${several ? `<td>${esc(m2.setupName)}</td>` : ""}<td>${matchHtml(profileOf(m2.setupId), data, m2.hrid)}</td>
          <td class="mwia-num">${m2.safe === null ? '<span class="mwia-bad">below 5</span>' : `<span>${lvl(m2.safe)}${floorText(m2.safe)}</span>`}</td>
          <td class="mwia-num">${m2.half === null ? '<span class="mwia-bad">below 5</span>' : lvl(m2.half)}</td>
          <td>${verdict2(winAt(m2.curve, level), point)}</td><td class="mwia-num">${time2 ? `${Math.round(time2)} s` : "\u2013"}</td>
          ${improve ? `<td><span>${swaps.get(m2.hrid) || '<span class="mwia-dim">\u2013</span>'}</span></td>` : ""}</tr>`;
    }
    return html + `</tbody></table>`;
  }
  function loadoutMatrix(lab) {
    if (lab.setups.length < 2) return "";
    let html = `<details class="mwia-skill-sec"><summary>All your loadouts: room level where each wins half the rooms</summary>
      <table class="mwia-table mwia-wide"><thead><tr><th>Monster</th>${lab.setups.map((s2) => `<th class="mwia-num">${esc(s2.name)}</th>`).join("")}</tr></thead><tbody>`;
    lab.monsters.forEach((best, i) => {
      html += `<tr><td>${esc(monsterName(best.hrid))}</td>${lab.setups.map((s2) => {
        const m2 = s2.monsters[i];
        const text = m2.half === null ? "below 5" : lvl(m2.half);
        return `<td class="mwia-num">${s2.id === best.setupId ? `<b>${text}</b>` : `<span class="mwia-dim">${text}</span>`}</td>`;
      }).join("")}</tr>`;
    });
    return html + `</tbody></table></details>`;
  }
  function bestSwaps(improve) {
    const out = /* @__PURE__ */ new Map();
    const dropOf = (c2, hrid) => improve.candidates.find((d) => d.kind === "swap" && !d.hrid && d.replaces === c2.replaces && d.setupName === c2.setupName)?.perMonster.find((m2) => m2.hrid === hrid);
    for (const c2 of improve.candidates) {
      if (c2.kind !== "swap") continue;
      for (const m2 of c2.perMonster) {
        if (m2.levels < 1 || m2.after <= m2.before) continue;
        const drop = c2.hrid && c2.replaces ? dropOf(c2, m2.hrid) : null;
        if (drop && m2.levels < drop.levels + 1) continue;
        const known = out.get(m2.hrid);
        if (!known || m2.levels > known.levels) out.set(m2.hrid, { levels: m2.levels, label: c2.label });
      }
    }
    return new Map([...out].map(([hrid, s2]) => [hrid, `${esc(s2.label)} <span class="mwia-dim">(\u2248 +${s2.levels.toFixed(1)} levels)</span>`]));
  }
  function improveHtml(improve) {
    const general = improve.candidates.filter((c2) => c2.kind !== "swap").sort((a, b) => b.levels - a.levels);
    const useful = general.filter((c2) => c2.levels >= 0.5);
    let html = `<h3>What takes you further</h3>
      <p class="mwia-dim">Each change is simulated against every monster, with the loadout you'd use for it, at the room level where you now win about
      half the rooms (${improve.rooms} rooms each). The gain is shown as room levels: how much deeper you could go for the same win rate, averaged over
      all ten room types. A monster's stats grow in proportion to the room level (at level 20 one level more is 5% stronger), so low down the gains look small.</p>`;
    if (!useful.length) html += `<p>None of the crates, skill levels or ability levels tested here takes you clearly further.</p>`;
    else {
      html += `<table class="mwia-table mwia-wide"><thead><tr><th>Work on</th><th class="mwia-num" title="Room levels gained, averaged over the ten room types">\u2248 Room levels</th><th>Helps most against</th></tr></thead><tbody>`;
      for (const c2 of useful) {
        const most = [...c2.perMonster].filter((m2) => m2.levels >= 1).sort((a, b) => b.levels - a.levels).slice(0, 4);
        html += `<tr><td>${esc(c2.label)}</td><td class="mwia-num">+${c2.levels.toFixed(1)}</td>
              <td>${most.map((m2) => `${esc(monsterName(m2.hrid))} <span class="mwia-dim">+${m2.levels.toFixed(1)}</span>`).join(", ") || '<span class="mwia-dim">spread out</span>'}</td></tr>`;
      }
      html += `</tbody></table>`;
    }
    const flat = [...new Set(general.filter((c2) => c2.levels < 0.5).map((c2) => c2.label))].map(esc);
    if (flat.length) html += `<p class="mwia-dim">No clear effect (within the noise): ${flat.join(", ")}.</p>`;
    html += `<p class="mwia-dim"><b>Better with</b> in the table above: an ability you know in place of one that monster's loadout uses.</p>`;
    return html;
  }
  function pickText(p2, coins10) {
    const gear = (hrid, level) => `${esc(itemName(hrid))}${level ? " +" + level : ""}`;
    const levels = `<span class="mwia-dim">\u2248 +${p2.levels.toFixed(1)} room levels</span>`;
    const price = p2.cost ? coins10(p2.cost) : p2.owned ? '<span class="mwia-ok">you own it</span>' : "free";
    if (p2.kind === "gear") {
      const how = p2.enhance ? ` <span class="mwia-dim">(\u{1F528} enhance it yourself)</span>` : "";
      return `${cap2(p2.slot.replace("_", " "))}: <b>${gear(p2.hrid, p2.enhancementLevel)}</b>${p2.replaces ? ` instead of ${gear(p2.replaces.hrid, p2.replaces.enhancementLevel)}` : ""}${how} \u2013 ${price} \xB7 ${levels}`;
    }
    if (p2.kind === "ability") return `Ability: <b>${esc(abilityName(p2.hrid))}</b>${p2.replaces ? ` instead of ${esc(abilityName(p2.replaces))}` : " in an empty slot"}${p2.cost ? " (book)" : ""} \u2013 ${price} \xB7 ${levels}`;
    if (p2.kind === "abilityLevel") return `Level <b>${esc(abilityName(p2.hrid))}</b> ${p2.fromLevel} \u2192 ${p2.level} (${p2.books} book${p2.books === 1 ? "" : "s"}) \u2013 ${price} \xB7 ${levels}`;
    if (p2.kind === "triggers") return `Run your abilities <b>without triggers</b> (cast as soon as they're ready) \u2013 free \xB7 ${levels}`;
    if (p2.kind === "drop") return `Take <b>${esc(abilityName(p2.hrid))}</b> off \u2013 free \xB7 ${levels}`;
    if (p2.kind === "dropAll") return `Take <b>all abilities</b> off (auto attacks only) \u2013 free \xB7 ${levels}`;
    return "";
  }
  function cartOf(build) {
    const items = [];
    if (build.starter && !build.starter.owned) items.push({ hrid: build.starter.hrid, quantity: 1, enhancementLevel: build.starter.enhancementLevel });
    for (const p2 of build.picks) {
      if (p2.kind === "gear" && !p2.owned && !p2.enhance) items.push({ hrid: p2.hrid, quantity: 1, enhancementLevel: p2.enhancementLevel });
      if ((p2.kind === "ability" || p2.kind === "abilityLevel") && p2.cost && p2.bookHrid) items.push({ hrid: p2.bookHrid, quantity: p2.books || 1, enhancementLevel: 0 });
    }
    return items;
  }
  function buildHtml(build, data, settings2, busy, settingsHtml3, cartButton5, coins10) {
    const style = buildStyleSetting(settings2);
    const targets = monstersFor(data, style).map((h3) => esc(monsterName(h3)));
    let html = `<h3>Build a loadout for the Labyrinth</h3>
      <p>Starts from your gear (<b>Gear from</b>) with a weapon for the style \u2013 yours, else the cheapest \u2013 and tries every piece of gear, every ability
      (new, or levelled with books), taking abilities off and running them without triggers against the room types weak to that style, at the room level where you now
      win about half. Ranked by room levels per coin \u2013 for winning 2-minute duels, not for XP or loot.</p>
      <div class="mwia-settings"><label title="The attack style to build for; the room types weak to it are the targets">Fight as
        <select data-setting="labyStyle">${ATTACK_STYLES.map((s2) => `<option value="${s2}" ${s2 === style ? "selected" : ""}>${cap2(s2)}</option>`).join("")}</select></label></div>
      ${settingsHtml3(["gear", "budget", "spending"])}
      <p class="mwia-dim">For: ${targets.join(", ") || "no room type"}.</p>
      <button class="mwia-btn" data-action="laby-build" ${busy ? "disabled" : ""}>Build loadout</button>`;
    if (!build || build.style !== style) return html;
    const before = new Map(build.before.map((m2) => [m2.hrid, m2]));
    html += `<div class="mwia-reco"><b>${cap2(build.style)} loadout</b> \u2013 ${build.picks.length || build.starter ? `for ${coins10(build.spent)} of your ${coins10(build.budget)}` : "nothing to buy"}`;
    if (build.starter) html += `<br>Weapon: <b>${esc(itemName(build.starter.hrid))}${build.starter.enhancementLevel ? " +" + build.starter.enhancementLevel : ""}</b> ${build.starter.owned ? '<span class="mwia-ok">you own it</span>' : "\u2013 " + coins10(build.starter.cost)}`;
    html += `<ol class="mwia-plan">${build.picks.map((p2) => `<li>${pickText(p2, coins10)}</li>`).join("") || "<li>Nothing tested takes these rooms clearly further within the budget.</li>"}</ol>`;
    const cart = cartOf(build);
    if (cart.length) html += cartButton5(cart, "\u{1F6D2} Add all to the cart");
    html += `</div><table class="mwia-table mwia-wide mwia-laby-built"><thead><tr><th>Monster</th><th class="mwia-num" title="Highest room level with at least ${pctText(SAFE_WIN)} of the rooms won">Safe: now</th><th class="mwia-num">Safe: built</th><th class="mwia-num" title="Room level where you win half the rooms">50%: now</th><th class="mwia-num">50%: built</th></tr></thead><tbody>`;
    for (const m2 of build.after) {
      const b = before.get(m2.hrid);
      const cell = (x) => x === null ? "below 5" : lvl(x);
      html += `<tr><td>${esc(monsterName(m2.hrid))}</td><td class="mwia-num">${cell(b.safe)}</td><td class="mwia-num"><span><b>${cell(m2.safe)}</b>${floorText(m2.safe)}</span></td>
          <td class="mwia-num">${cell(b.half)}</td><td class="mwia-num"><b>${cell(m2.half)}</b></td></tr>`;
    }
    html += `</tbody></table>`;
    if (build.nearMisses?.length) {
      html += `<details class="mwia-skill-sec"><summary>Also tested: the closest that didn't make the list (on top of it)</summary><ul>${build.nearMisses.map((p2) => `<li>${pickText(p2, coins10)}</li>`).join("")}</ul></details>`;
    }
    html += `<p class="mwia-dim">"Now" is your gear (Gear from)${build.starter ? " with the weapon above" : ""}. Put the list on in the game, save it as a
      loadout and pick it for these room types in the Labyrinth automation. ${build.tested} changes tested; each has to take you at least half a room level further
      (and a purchase, under <b>Spending</b>, Frugal: 2 levels per 1M, Balanced: 0.5, All in: anything within the budget).</p>`;
    return html;
  }
  var OUTCOME = { win: "\u2705 won", loss: "\u2716 lost", shroud: "\u{1F32B} shrouded", cleared: "cleared" };
  function attemptName(a) {
    return a.type === "combat" ? monsterName(`/monsters/${a.what}`) : cap2(a.what);
  }
  function attemptsHtml(summary2, recent) {
    let html = `<h3>Your attempts</h3>`;
    if (!summary2.length) {
      return html + `<p class="mwia-dim">Each room you fight or skill in the Labyrinth is logged here from now on (and sent to your Pi when it takes them):
          won, lost or shrouded, at what room level, with your levels, the loadout chosen for it, crates and shop upgrades, and the chance the advisor gave it.</p>`;
    }
    const levels = (s2) => s2.minLevel === null ? "\u2013" : s2.minLevel === s2.maxLevel ? String(s2.minLevel) : `${s2.minLevel}\u2013${s2.maxLevel}`;
    html += `<table class="mwia-table"><thead><tr><th>Room</th><th title="Room levels tried">Level</th><th title="Fights or skilling tries (shrouds not counted)">Tries</th>
      <th title="Share of the tries won">Won</th><th title="The advisor's average chance for those tries (combat: with the loadout the last check found best)">Advisor said</th><th title="Rooms shrouded">\u{1F32B}</th></tr></thead><tbody>
      ${summary2.map((s2) => `<tr><td>${esc(attemptName(s2))}</td><td>${levels(s2)}</td><td>${s2.tries}</td><td>${s2.won === null ? "\u2013" : `${pctText(s2.won)} <span class="mwia-dim">(${s2.wins}/${s2.tries})</span>`}</td>
        <td>${s2.predicted === null ? "\u2013" : pctText(s2.predicted)}</td><td>${s2.shrouds || ""}</td></tr>`).join("")}</tbody></table>`;
    html += `<details class="mwia-skill-sec"><summary>The latest ${recent.length}</summary><ol class="mwia-plan">${recent.map((a) => `<li>${new Date(a.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} \xB7 floor ${a.floor} \xB7 Lv.${a.level} ${esc(attemptName(a))}: ${OUTCOME[a.outcome] || a.outcome}${a.loadout?.name ? ` \xB7 ${esc(a.loadout.name)}` : ""}${a.predicted ? ` \xB7 advisor ${pctText(a.predicted.win)}${a.predicted.forChosen === false ? " (another loadout)" : ""}` : ""}${a.late ? ` <span class="mwia-dim" title="Found on login: it happened while the game was closed">(late)</span>` : ""}</li>`).join("")}</ol></details>`;
    return html;
  }
  function renderLabyrinth({ lab, improve, build, profileOf, data, settings: settings2, busy, settingsHtml: settingsHtml3, slotted, setupsNote, cartButton: cartButton5, coins: coins10 = shortCoins, attempts = "" }) {
    const level = roomLevelSetting(settings2);
    let html = `<p>Simulates your combat loadouts against each of the ten Labyrinth monsters, room level by room level, as the game fights a combat room:
      1 against 1, scaled to the room level, from full HP and mana, <b>no food or drinks</b> (only the crates you open on entry) and <b>2 minutes</b> to win.
      The game's Labyrinth automation can put on a loadout for each room type, so every monster is judged with the loadout that does best against it.</p>
      ${settingsHtml3(["accuracy"])}${setupsNote}
      <div class="mwia-settings">${crateSelect(settings2, "coffee", slotted.coffee)}${crateSelect(settings2, "food", slotted.food)}${floorSelect(level)}
      <label title="The room level to judge the rooms at; changing it needs no new simulation">Room level
        <input data-setting="labyLevel" type="number" min="1" max="300" step="1" size="4" value="${level}"></label></div>
      <button class="mwia-btn" data-action="laby-check" ${busy ? "disabled" : ""}>Check the rooms</button>`;
    if (lab) {
      const crates = Object.entries(lab.crates).filter(([, t4]) => t4).map(([k, t4]) => `${cap2(t4)} ${CRATE_KINDS[k]}`);
      html += `<p class="mwia-dim">Simulated with ${crates.length ? crates.join(" and ") : "no crates"}, ${lab.rooms} rooms per monster and room level, ${lab.setups.length} loadout${lab.setups.length === 1 ? "" : "s"}.</p>`;
      html += summaryHtml2(lab, level);
      html += roomGuide(lab, data, level);
      html += monsterTable(lab, profileOf, data, level, improve);
      html += loadoutMatrix(lab);
      html += `<button class="mwia-btn" data-action="laby-improve" ${busy ? "disabled" : ""}>What should I improve?</button>`;
      if (improve) html += improveHtml(improve);
    }
    html += buildHtml(build, data, settings2, busy, settingsHtml3, cartButton5, coins10);
    html += attempts;
    html += `<h3>On the Labyrinth map</h3>
      <p>Next: marks on the game's Labyrinth map (and later its automation settings) saying which loadout to use in each room. For that the script
      first has to learn how the game shows the Labyrinth: it keeps what the game sends about it while you play. After a run (or with the Labyrinth
      open \u2013 on its Automation tab for the per-room settings), tap this and paste the report into the chat \u2013 it only reads, nothing is changed.</p>
      <button class="mwia-btn" data-action="laby-read">\u{1F4CB} Read the game's Labyrinth</button>`;
    html += `<p class="mwia-dim">Each monster hardly dodges one or two attack styles and takes far more of one damage type (<b>Weak to</b>): the Labyrinth wants
      magic for some rooms, ranged for others and melee (stab, slash or smash) for the rest. Single-target damage is what counts in a 1-against-1 room.
      Shrouds clear a room without a fight (Basic: 2% fail chance per level above 50, Advanced above 100, Expert never fails).
      Floors are rough (floor 1 \u2248 room level ${FLOOR_ONE_LEVEL}, +${FLOOR_STEP} a floor; rooms on a floor differ). Estimates from the community simulator's Labyrinth rules \u2013 the game can differ.</p>`;
    return html;
  }
  function labyrinthExportLines(lab, improve, build, settings2) {
    const lines = [];
    const level = roomLevelSetting(settings2);
    if (lab) {
      lines.push(`Crates: coffee ${lab.crates.coffee || "none"}, food ${lab.crates.food || "none"} \xB7 room level ${level} \xB7 loadouts ${lab.setups.map((s2) => s2.name).join(", ")}`);
      for (const m2 of lab.monsters) {
        lines.push(`${monsterName(m2.hrid)} (${m2.setupName}): safe up to ${m2.safe ?? "<5"} \xB7 50% at ${m2.half === null ? "<5" : Math.round(m2.half)} \xB7 at ${level}: ${pctText(winAt(m2.curve, level))}`);
      }
    }
    if (improve) for (const c2 of improve.candidates.filter((c3) => c3.kind !== "swap" && c3.levels >= 0.5).sort((a, b) => b.levels - a.levels)) lines.push(`Work on: ${c2.label} \u2248 +${c2.levels.toFixed(1)} room levels`);
    if (build) {
      lines.push(`Built ${build.style} loadout for ${shortCoins(build.spent)}${build.starter ? ` with ${itemName(build.starter.hrid)}` : ""}: ${build.picks.map((p2) => p2.kind === "triggers" ? "no triggers" : p2.kind === "dropAll" ? "no abilities" : p2.kind === "drop" ? "without " + abilityName(p2.hrid) : p2.kind === "gear" ? itemName(p2.hrid) + (p2.enhancementLevel ? " +" + p2.enhancementLevel : "") : abilityName(p2.hrid) + (p2.kind === "abilityLevel" ? ` ${p2.level}` : "")).join(", ") || "nothing"}`);
      for (const m2 of build.after) lines.push(`  ${monsterName(m2.hrid)}: 50% at ${m2.half === null ? "<5" : Math.round(m2.half)}`);
    }
    return lines;
  }

  // src/labyrinth-read.js
  var MAX_LINES2 = 400;
  var attempt3 = (read, fallback = null) => {
    try {
      return read();
    } catch {
      return fallback;
    }
  };
  var clean4 = (text) => String(text || "").replace(/\s+/g, " ").trim();
  var short2 = (text, n5 = 60) => text.length > n5 ? text.slice(0, n5) + "\u2026" : text;
  var LAB_WORDS = /labyrinth|maze|room|floor|beacon|torch|shroud|crate|automation/i;
  function shapeOf(value, depth = 0) {
    if (value === null || value === void 0) return String(value);
    if (typeof value === "string") return JSON.stringify(short2(value, 40));
    if (typeof value !== "object") return String(value);
    if (depth >= 5) return Array.isArray(value) ? `[${value.length}]` : "{\u2026}";
    if (Array.isArray(value)) return value.length ? `[${value.length}\xD7 ${shapeOf(value[0], depth + 1)}]` : "[]";
    const entries = Object.entries(value);
    if (entries.length > 12 && entries.every(([, v]) => v && typeof v === "object")) return `{${entries.length} keys like ${JSON.stringify(short2(entries[0][0], 40))}: ${shapeOf(entries[0][1], depth + 1)}}`;
    return `{${entries.slice(0, 30).map(([k, v]) => `${k}: ${shapeOf(v, depth + 1)}`).join(", ")}${entries.length > 30 ? ", \u2026" : ""}}`;
  }
  function messageLines(lines) {
    const log2 = labyrinthMessages();
    if (!log2.length) {
      lines.push("messages: none mentioning the Labyrinth yet \u2013 open the Labyrinth (and a run, if you can) with the script on, then read again");
      return;
    }
    lines.push(`messages: ${log2.length} kept (${[...new Set(log2.map((m2) => m2.type))].join(", ")})`);
    const latest = /* @__PURE__ */ new Map();
    for (const m2 of log2) latest.set(m2.type, m2);
    for (const m2 of latest.values()) {
      const data = attempt3(() => JSON.parse(m2.raw));
      lines.push(`\u2014 ${m2.type} (${m2.size} chars, ${new Date(m2.at).toISOString().slice(0, 16)}Z)`);
      lines.push(`  shape: ${data ? shapeOf(data) : "(cut \u2013 not whole JSON)"}`);
      lines.push(`  text: ${short2(m2.raw, 1500)}`);
    }
  }
  function characterLines(lines) {
    const character = state.character;
    if (!character) {
      lines.push("character: not seen yet");
      return;
    }
    const fields = Object.keys(character).filter((k) => /labyrinth|maze/i.test(k));
    lines.push(`character fields: ${fields.join(", ") || "none with labyrinth in the name"}`);
    for (const key2 of fields) lines.push(`  ${key2}: ${short2(shapeOf(character[key2]), 1200)}`);
  }
  function ownText4(el) {
    return clean4([...el.childNodes].filter((n5) => n5.nodeType === 3).map((n5) => n5.textContent).join(" "));
  }
  function pageLines(lines) {
    const all = [...document.querySelectorAll('[class*="abyrinth"]')].filter((el) => !el.closest('[class*="mwia"]'));
    const tops = all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
    lines.push(`page: ${all.length} elements with "Labyrinth" in a class, ${tops.length} outermost (${tops.filter(visible).length} visible)`);
    const walk = (el, depth) => {
      if (lines.length >= MAX_LINES2 || depth > 9) return;
      const text = ownText4(el);
      const title = el.getAttribute("title") || el.getAttribute("aria-label");
      const icons = el.tagName.toLowerCase() === "use" ? ` #${(el.getAttribute("href") || el.getAttribute("xlink:href") || "").split("#")[1] || ""}` : "";
      const style = el.getAttribute("style");
      lines.push(`${"  ".repeat(depth + 1)}${describe(el)}${text ? ` "${short2(text, 40)}"` : ""}${title ? ` title="${short2(title, 40)}"` : ""}${style && /grid|left|top/.test(style) ? ` style="${short2(style, 60)}"` : ""}${icons}`);
      const children = [...el.children];
      children.slice(0, 6).forEach((child) => walk(child, depth + 1));
      if (children.length > 6) lines.push(`${"  ".repeat(depth + 2)}\u2026 ${children.length - 6} more like ${describe(children[6])}`);
    };
    for (const top of tops.slice(0, 4)) walk(top, 0);
  }
  var CONTROLS = 'select, input, button, [role="button"], [role="combobox"], [aria-haspopup], [class*="elect"]';
  function controlText(el) {
    const value = el.tagName === "SELECT" ? ` value="${el.value}" options: ${[...el.options].map((o2) => clean4(o2.textContent)).join(" / ")}` : "value" in el && el.value ? ` value="${short2(String(el.value), 40)}"` : "";
    const role = el.getAttribute("role") ? ` role=${el.getAttribute("role")}` : "";
    return `${describe(el)}${role}${value} "${short2(clean4(el.textContent), 30)}"`;
  }
  function tableLines(lines) {
    const inLab = (el) => el.closest('[class*="abyrinth"]') || /Room Type/i.test(el.textContent);
    const tables = [...document.querySelectorAll('table, [role="table"], [role="grid"]')].filter((t4) => !t4.closest('[class*="mwia"]') && inLab(t4));
    lines.push(`tables: ${tables.length} on the Labyrinth page (${tables.filter(visible).length} visible)`);
    for (const table of tables.slice(0, 3)) {
      const chain = [];
      for (let node = table.parentElement; node && node !== document.body && chain.length < 5; node = node.parentElement) chain.push(describe(node));
      lines.push(`\u2014 ${describe(table)} in ${chain.join(" < ")}`);
      const heads = [...table.querySelectorAll("th, [role=columnheader]")].map((h3) => clean4(h3.textContent));
      if (heads.length) lines.push(`  headers: ${heads.join(" | ")}`);
      const rows = [...table.querySelectorAll('tr, [role="row"]')].filter((r) => !r.querySelector("th")).map((r) => {
        const copy = r.cloneNode(true);
        copy.querySelectorAll('[class*="mwia"]').forEach((n5) => n5.remove());
        return copy;
      });
      rows.slice(0, 30).forEach((row, i) => {
        const cells = [...row.querySelectorAll('td, [role="cell"]')].map((c2) => short2(clean4(c2.textContent), 30));
        const controls2 = [...row.querySelectorAll(CONTROLS)].filter((c2, _, all) => !all.some((o2) => o2 !== c2 && o2.contains(c2)));
        lines.push(`  row ${i + 1}: ${cells.join(" | ")}${controls2.length ? ` \u27F6 ${controls2.map(controlText).join(" ; ")}` : ""}`);
      });
      if (rows.length > 30) lines.push(`  \u2026 ${rows.length - 30} more rows`);
      const last = rows[rows.length - 1];
      if (last) lines.push(`  last row html: ${short2(last.outerHTML.replace(/\s(d|points)="[^"]{40,}"/g, ' $1="\u2026"').replace(/\s+/g, " "), 2e3)}`);
    }
  }
  var typeName2 = (f) => attempt3(() => typeof f.type === "string" ? f.type : f.type?.displayName || f.type?.name || "?", "?");
  function componentLines(lines) {
    const seen = /* @__PURE__ */ new Set();
    let count3 = 0;
    walkFibers((f) => {
      if (count3 >= 20 || lines.length >= MAX_LINES2) return true;
      if (typeof f.type === "string") return false;
      const props = f.memoizedProps;
      const keys = props && typeof props === "object" ? Object.keys(props).filter((k) => k !== "children" && LAB_WORDS.test(k)) : [];
      const stateKeys = f.stateNode && typeof f.stateNode === "object" && f.stateNode.state && typeof f.stateNode.state === "object" ? Object.keys(f.stateNode.state).filter((k) => LAB_WORDS.test(k)) : [];
      if (!keys.length && !stateKeys.length) return false;
      const name = typeName2(f);
      const id = `${name}:${keys.join(",")}:${stateKeys.join(",")}`;
      if (seen.has(id)) return false;
      seen.add(id);
      count3++;
      lines.push(`component ${name}: ${[...keys.map((k) => `${k}=${short2(shapeOf(props[k]), 400)}`), ...stateKeys.map((k) => `state.${k}=${short2(shapeOf(f.stateNode.state[k]), 400)}`)].join("; ")}`);
      return false;
    });
    if (!count3) lines.push("components: none with labyrinth/room/floor data in their props");
  }
  function labyrinthReport() {
    const lines = [`world: ${attempt3(worldReport, "?")}`];
    for (const part2 of [messageLines, characterLines, tableLines, pageLines, componentLines]) {
      try {
        part2(lines);
      } catch (error) {
        lines.push(`(${part2.name} failed: ${error?.message || error})`);
      }
    }
    if (lines.length > MAX_LINES2) lines.splice(MAX_LINES2, lines.length - MAX_LINES2, `\u2026 cut at ${MAX_LINES2} lines`);
    return lines.join("\n");
  }

  // src/horizon.js
  var ACTION_TYPE = "/action_types/";
  function planAdviceKey(plan) {
    const best = plan?.plans?.[plan.best];
    if (!best) return "";
    return [best.name, best.first?.jobs?.[0]?.hrid || ""].join("|");
  }
  var ACTION_FIELDS = ["hrid", "function", "type", "category", "name", "levelRequirement", "baseTimeCost", "experienceGain", "dropTable", "essenceDropTable", "rareDropTable", "upgradeItemHrid", "inputItems", "outputItems", "sortIndex"];
  function planData(data) {
    const pick2 = (object, fields) => Object.fromEntries(fields.filter((f) => object[f] !== void 0).map((f) => [f, object[f]]));
    const types = new Set(SKILLING_SKILLS.map((s2) => ACTION_TYPE + s2));
    const actionDetailMap = {};
    for (const [hrid, action] of Object.entries(data.actionDetailMap || {})) {
      if (types.has(action.type) && /\/(gathering|production)$/.test(action.function || "")) actionDetailMap[hrid] = pick2(action, ACTION_FIELDS);
    }
    const itemDetailMap = {};
    for (const [hrid, item] of Object.entries(data.itemDetailMap || {})) {
      const out = pick2(item, ["hrid", "name", "isTradable", "sellPrice", "sortIndex"]);
      if (item.consumableDetail) out.consumableDetail = pick2(item.consumableDetail, ["usableInActionTypeMap", "buffs"]);
      if (item.equipmentDetail) out.equipmentDetail = pick2(item.equipmentDetail, ["type", "levelRequirements", "noncombatStats", "noncombatEnhancementBonuses"]);
      itemDetailMap[hrid] = out;
    }
    const houseRoomDetailMap = {};
    for (const [hrid, room] of Object.entries(data.houseRoomDetailMap || {})) houseRoomDetailMap[hrid] = pick2(room, ["hrid", "name", "skillHrid", "usableInActionTypeMap", "actionBuffs", "globalBuffs", "upgradeCostsMap"]);
    const trimmed = {
      actionDetailMap,
      itemDetailMap,
      houseRoomDetailMap,
      openableLootDropMap: data.openableLootDropMap || {},
      levelExperienceTable: data.levelExperienceTable || null,
      enhancementLevelTotalBonusMultiplierTable: data.enhancementLevelTotalBonusMultiplierTable || null
    };
    return { hash: textHash(JSON.stringify(trimmed)), data: trimmed };
  }
  function textHash(text) {
    let h1 = 2166136261;
    let h22 = 16777619 ^ text.length;
    for (let i = 0; i < text.length; i++) {
      const c2 = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c2, 16777619);
      h22 = Math.imul(h22 ^ c2, 1540483477);
    }
    return (h1 >>> 0).toString(16).padStart(8, "0") + (h22 >>> 0).toString(16).padStart(8, "0");
  }

  // src/horizon-sync.js
  var KEPT_KEY = "mwia-horizon";
  var SEND_EVERY_MS = 30 * 60 * 1e3;
  var POLL_MS = 15 * 1e3;
  var POLLS = 12;
  var COIN11 = "/items/coin";
  var INVENTORY9 = "/item_locations/inventory";
  var h2 = { plan: null, status: null, error: "", sentAt: 0, sending: null, reading: null, piHash: null, asked: 0, polls: 0, settings: () => ({}), listeners: /* @__PURE__ */ new Set(), packed: null };
  var characterId3 = () => state.character?.character?.id ?? null;
  function kept() {
    try {
      return JSON.parse(localStorage.getItem(KEPT_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function keep(fields) {
    const id = characterId3();
    if (id === null) return;
    try {
      const all = kept();
      all[id] = { ...all[id] || {}, ...fields };
      localStorage.setItem(KEPT_KEY, JSON.stringify(all));
    } catch {
    }
  }
  var mine = () => characterId3() === null ? {} : kept()[characterId3()] || {};
  function onHorizonChange(listener) {
    h2.listeners.add(listener);
  }
  var notify2 = () => h2.listeners.forEach((listener) => listener());
  function startHorizonSync({ settings: settings2, prepare = async () => {
  } }) {
    h2.settings = settings2;
    h2.prepare = prepare;
    onPiSync(() => {
      if (!piStatus().plan || characterId3() === null) return;
      readPlan();
      if (Date.now() - h2.sentAt > SEND_EVERY_MS) sendSnapshot();
    });
  }
  var horizonOptions = (settings2) => ({ days: Number(settings2.horizonDays) || 30, levelDays: Number(settings2.horizonLevelDays ?? 7) });
  function horizonState() {
    const plan = h2.plan || mine().plan || null;
    return { linked: !!piConfig(), makesPlans: !!piStatus().plan, piOk: piStatus().ok, plan, status: h2.status, error: h2.error, sentAt: h2.sentAt, asked: h2.asked, waiting: h2.asked > 0 && !(plan?.snapshotAt >= h2.asked) && h2.polls < POLLS };
  }
  function horizonNews() {
    const plan = horizonState().plan;
    const key2 = planAdviceKey(plan);
    return !!key2 && key2 !== mine().seen;
  }
  function markHorizonSeen() {
    const key2 = planAdviceKey(horizonState().plan);
    if (key2 && key2 !== mine().seen) {
      keep({ seen: key2 });
      notify2();
    }
  }
  function horizonSnapshot(options) {
    const data = getClientData();
    if (!state.character || !data) return null;
    const who = skillingCharacter(state.character, state.items, data);
    const owned = {};
    const gear = /* @__PURE__ */ new Map();
    for (const item of state.items.values()) {
      if (item.itemLocationHrid !== INVENTORY9) continue;
      const detail = data.itemDetailMap[item.itemHrid]?.equipmentDetail;
      if (/_tool$/.test(detail?.type || "")) {
        if (!item.enhancementLevel) owned[item.itemHrid] = (owned[item.itemHrid] || 0) + (item.count || 1);
      } else if (Object.keys(detail?.noncombatStats || {}).length) {
        const level = item.enhancementLevel || 0;
        gear.set(`${item.itemHrid}+${level}`, { itemHrid: item.itemHrid, enhancementLevel: level });
      }
    }
    h2.packed = h2.packed?.source === data ? h2.packed : { source: data, ...planData(data) };
    return {
      character: { id: characterId3(), name: state.character.character?.name || null },
      at: Date.now(),
      version: scriptVersion(),
      who,
      coins: heldStock(state.character, state.items, COIN11).inventory,
      owned,
      gear: [...gear.values()],
      options,
      dataHash: h2.packed.hash
    };
  }
  function sendSnapshot({ run = false } = {}) {
    const config = piConfig();
    if (!config || !piStatus().plan) return Promise.resolve(false);
    h2.sending || (h2.sending = (async () => {
      try {
        await h2.prepare?.();
        const snapshot2 = horizonSnapshot(horizonOptions(h2.settings()));
        if (!snapshot2) throw new Error("the game's data isn't loaded yet");
        const post = (withData) => fetch(`${config.url}/snapshot`, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot: snapshot2, run, ...withData ? { data: { hash: h2.packed.hash, data: h2.packed.data } } : {} }),
          cache: "no-store",
          signal: AbortSignal.timeout?.(12e4)
        });
        let response = await post(h2.piHash !== snapshot2.dataHash);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let answer = await response.json();
        if (answer.needData) {
          response = await post(true);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          answer = await response.json();
        }
        h2.piHash = answer.dataHash ?? h2.piHash;
        h2.sentAt = Date.now();
        h2.error = "";
        if (run) {
          h2.asked = snapshot2.at;
          h2.polls = 0;
          setTimeout(poll, POLL_MS);
        }
        return true;
      } catch (error) {
        h2.error = `Sending to the Pi: ${error.message || error}`;
        return false;
      } finally {
        h2.sending = null;
        notify2();
      }
    })());
    return h2.sending;
  }
  function poll() {
    h2.polls++;
    readPlan().then(() => {
      if (h2.asked && !(h2.plan?.snapshotAt >= h2.asked) && h2.polls < POLLS) setTimeout(poll, POLL_MS);
      else notify2();
    });
  }
  function readPlan() {
    const config = piConfig();
    const id = characterId3();
    if (!config || id === null) return Promise.resolve();
    h2.reading || (h2.reading = (async () => {
      try {
        const response = await fetch(`${config.url}/plan?character=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout?.(6e4) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const answer = await response.json();
        h2.status = { ...answer.status, snapshotAt: answer.snapshotAt ?? null };
        h2.piHash = answer.dataHash ?? h2.piHash;
        if (answer.plan && !(h2.plan?.at >= answer.plan.at)) {
          h2.plan = answer.plan;
          keep({ plan: answer.plan });
        }
        h2.error = "";
      } catch (error) {
        h2.error = `Reading the plan from the Pi: ${error.message || error}`;
      } finally {
        h2.reading = null;
        notify2();
      }
    })());
    return h2.reading;
  }

  // src/horizon-ui.js
  var DAY_CHOICES = [7, 14, 30, 60, 90];
  var LEVEL_DAY_CHOICES = [0, 3, 7, 14, 30];
  var coins8 = (n5) => (n5 < 0 ? "\u2212" : "") + shortCoins(Math.abs(n5));
  var signed2 = (n5) => (n5 >= 0 ? "+" : "\u2212") + shortCoins(Math.abs(n5));
  var skillLabel4 = (hrid) => {
    const name = String(hrid || "").split("/").pop();
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  var dayText = (d) => {
    const rounded = Math.round(d * 3) / 3;
    const whole2 = Math.floor(rounded + 1e-9);
    const third = Math.round((rounded - whole2) * 3);
    return third ? `${whole2}${third === 1 ? "\u2153" : "\u2154"}` : String(whole2);
  };
  function ago2(ms) {
    if (!ms) return "\u2014";
    const minutes = Math.round((Date.now() - ms) / 6e4);
    if (minutes < 1) return "just now";
    if (minutes < 90) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
  }
  function inTime(ms) {
    const minutes = Math.round((ms - Date.now()) / 6e4);
    if (minutes <= 0) return "now";
    if (minutes < 90) return `in ${minutes} min`;
    return `in ${Math.round(minutes / 60)} h`;
  }
  var plusName = (hrid, level) => `${esc(itemName(hrid))}${level ? ` +${level}` : ""}`;
  var roomName = (hrid) => String(hrid || "").split("/").pop().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  function purchaseText2(x, day) {
    const when = day === null ? "" : `Day ${dayText(day)}: `;
    const verb = (word) => day === null ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    const gain = ` (+${coins8(x.gainPerDay)}/day)`;
    if (x.kind === "house") return `\u{1F3E0} ${when}${verb("build")} the ${esc(roomName(x.roomHrid))} to level ${x.level} for ${coins8(x.price)}${gain}`;
    const icon = x.gear ? "\u{1F455}" : "\u{1F6E0}";
    const what = day === null ? `<b>${plusName(x.itemHrid, x.level)}</b>` : plusName(x.itemHrid, x.level);
    const sold = x.sold ? `, sell ${plusName(x.sold, x.soldLevel)} for ${coins8(x.resale)}` : "";
    return `${icon} ${when}${x.owned ? `${verb("put on")} ${what} (you have it)` : `${verb("buy")} ${what} for ${coins8(x.price)}`}${sold}${gain}`;
  }
  var teaText = (teas) => teas?.length ? teas.map((t4) => esc(itemName(t4))).join(", ") : "no teas";
  function settingsHtml(settings2) {
    const o2 = horizonOptions(settings2);
    const option = (value, label3, current) => `<option value="${value}" ${Number(current) === value ? "selected" : ""}>${label3}</option>`;
    return `<div class="mwia-settings">
      <label title="How far ahead the plan looks.">Days <select data-setting="horizonDays">${DAY_CHOICES.map((d) => option(d, `${d} days`, o2.days)).join("")}</select></label>
      <label title="Levels can't be sold, so the plan counts what the character can earn a day at the end, this many times, on top of what it is worth. With 0 a plan never trains near its end.">Levels worth <select data-setting="horizonLevelDays">${LEVEL_DAY_CHOICES.map((d) => option(d, d ? `${d} days of income` : "nothing", o2.levelDays)).join("")}</select></label>
      <button class="mwia-btn" data-action="horizon-run" title="Send your character to the Pi now and have it work the plan out (it takes the Pi a minute or two).">\u25B6 Plan now</button>
    </div>`;
  }
  function statusHtml2(st, settings2) {
    const lines = [];
    const plan = st.plan;
    if (plan) {
      const o2 = horizonOptions(settings2);
      const changed2 = plan.options && (plan.options.days !== o2.days || plan.options.levelDays !== o2.levelDays);
      lines.push(`Worked out ${ago2(plan.at)} (${Math.round((plan.ms || 0) / 100) / 10} s on the Pi, ${plan.weighed ? `${plan.weighed.toLocaleString("en-US")} plans weighed, ${plan.tried} simulated` : `${plan.tried} plans tried`}) from your character as it was ${ago2(plan.snapshotAt)}${changed2 ? ` \u2013 <b>with other settings</b> (${plan.options.days} days, levels worth ${plan.options.levelDays} days): tap \u25B6 Plan now` : ""}.`);
    }
    if (st.waiting) lines.push(`<span class="mwia-warn">\u23F3 The Pi is working the plan out\u2026</span>`);
    else if (st.status?.running) lines.push(`<span class="mwia-warn">\u23F3 The Pi is working the plan out\u2026</span>`);
    else if (st.status?.next) lines.push(`Next plan ${inTime(st.status.next)}.`);
    if (st.status?.error) lines.push(`<span class="mwia-bad">The Pi's last try failed: ${esc(st.status.error)}</span>`);
    if (st.error) lines.push(`<span class="mwia-bad">${esc(st.error)}</span>`);
    return lines.length ? `<p class="mwia-dim">${lines.join(" ")}</p>` : "";
  }
  var gearText = (gear, before = " \xB7 ") => gear?.length ? `${before}<span class="mwia-dim">\u{1F455} ${gear.map((h3) => esc(itemName(h3))).join(", ")}</span>` : "";
  function firstHtml(plan, best) {
    const first = best.first;
    if (!first?.jobs?.length) return `<p>Nothing pays right now \u2013 the plan has no job for the next ${plan.options.blockHours} hours.</p>`;
    const jobs = first.jobs.slice().sort((x, y) => y.hours - x.hours);
    const rows = jobs.map((j2) => `<li><b>${esc(j2.name)}</b> (${skillLabel4(j2.skill)}) \u2013 ${Math.round(j2.hours * 10) / 10} h, about ${j2.actions.toLocaleString("en-US")} actions, ${teaText(j2.teas)}; ${coins8(j2.goldPerHour)}/h, ${j2.xpPerHour.toLocaleString("en-US")} XP/h${gearText(j2.gear, "<br>")}</li>`).join("");
    const buys = best.purchases.filter((x) => x.day === 0).map((x) => `<li>${purchaseText2(x, null)}</li>`).join("");
    const idle = first.idle > 0.1 ? `<li class="mwia-dim">${Math.round(first.idle * 10) / 10} h left: your coins or the market don't carry more.</li>` : "";
    return `<p><b>The next ${plan.options.blockHours} hours:</b></p><ul>${buys}${rows}${idle}</ul>`;
  }
  function compareHtml(plan) {
    const best = plan.plans[plan.best];
    const out = [];
    const against = (index, label3) => {
      if (index < 0 || index === plan.best) return;
      const other = plan.plans[index];
      const diff = (n5) => n5 >= 0 ? `${coins8(n5)} more` : `${coins8(-n5)} less`;
      out.push(`${label3} (<i>${esc(other.name)}</i>): ${diff(best.gain - other.gain)} in ${plan.options.days} days, ${diff(best.endRate - other.endRate)} a day at the end`);
    };
    against(plan.only, "Against keeping to what earns now");
    against(plan.baseline, "Against earning the most every block");
    if (plan.cautiousBest !== null && plan.cautiousBest !== void 0) out.push(`<span class="mwia-warn">With cautious prices (buying at the week's upper quartile, selling at its lower) <i>${esc(plan.plans[plan.cautiousBest].name)}</i> does best \u2013 the choice is close.</span>`);
    if (best.noCommunity) {
      const lost = best.gain - best.noCommunity.gain;
      out.push(`Without the community buffs it would be ${signed2(best.noCommunity.gain)} (${coins8(lost)} less, ${Math.round(lost / Math.max(1, Math.abs(best.gain)) * 100)}%).`);
    }
    if (plan.noCommunityBest !== null && plan.noCommunityBest !== void 0) out.push(`<span class="mwia-warn">Without the community buffs <i>${esc(plan.plans[plan.noCommunityBest].name)}</i> would do best \u2013 this plan leans on them.</span>`);
    return out.length ? `<ul>${out.map((line) => `<li>${line}</li>`).join("")}</ul>` : "";
  }
  function sparkline(values) {
    if (!values?.length || values.length < 2) return "";
    const low = Math.min(...values);
    const high = Math.max(...values);
    const span = high - low || 1;
    const points = values.map((v, i) => `${i / (values.length - 1) * 100},${28 - (v - low) / span * 26}`).join(" ");
    return `<svg class="mwia-horizon-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-label="Worth day by day"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function stepsHtml(p2) {
    const segs = p2.segments.map((s2) => {
      const xp = Object.entries(s2.xp).map(([skill, amount2]) => `${skillLabel4(skill)} ${shortCoins(amount2)} XP`).join(", ");
      const also = s2.also.length ? ` <span class="mwia-dim">(also ${s2.also.slice(0, 4).map(esc).join(", ")}${s2.also.length > 4 ? ", \u2026" : ""} when the first can't fill the hours)</span>` : "";
      return `<tr><td>Day ${dayText(s2.from)}\u2013${dayText(s2.to)}</td><td><b>${esc(s2.name)}</b>${s2.skill ? ` (${skillLabel4(s2.skill)})` : ""}${also}<br><span class="mwia-dim">${teaText(s2.teas)}${s2.tool ? ` \xB7 ${esc(itemName(s2.tool))}` : ""}</span>${gearText(s2.gear)}</td><td class="mwia-num">${coins8(s2.gold)}</td><td>${xp}</td></tr>`;
    }).join("");
    const buys = p2.purchases.map((x) => `<li>${purchaseText2(x, x.day)}</li>`).join("");
    const levels = Object.entries(p2.levels).map(([skill, [from, to]]) => `${skillLabel4(skill)} ${from} \u2192 ${to}`).join(", ");
    const house = Object.entries(p2.house || {}).map(([room, [from, to]]) => `${esc(roomName(room))} ${from} \u2192 ${to}`).join(", ");
    return `<table class="mwia-horizon-steps"><thead><tr><th>When</th><th>Job</th><th>Gold</th><th>XP</th></tr></thead><tbody>${segs}</tbody></table>
      ${buys ? `<p><b>Tools, clothes and house</b></p><ul>${buys}</ul>` : ""}
      ${levels ? `<p><b>Levels</b>: ${levels}</p>` : ""}
      ${house ? `<p><b>House</b>: ${house}</p>` : ""}
      <p class="mwia-dim">Worth day by day: ${sparkline(p2.worthByDay)}</p>`;
  }
  function plansHtml(plan) {
    return plan.plans.map((p2, i) => {
      const tags = [i === plan.best ? "\u{1F4C8} best" : "", i === plan.baseline ? "earn the most" : "", i === plan.only ? "what earns now" : ""].filter(Boolean).join(" \xB7 ");
      const cautious = [p2.cautious ? `cautious ${signed2(p2.cautious.gain)}` : "", p2.noCommunity ? `no community buffs ${signed2(p2.noCommunity.gain)}` : ""].filter(Boolean).join(" \xB7 ");
      return `<details class="mwia-horizon-plan" ${i === plan.best ? "open" : ""}><summary><b>${esc(p2.name)}</b>${tags ? ` <span class="mwia-dim">${tags}</span>` : ""}<br>
          <span class="mwia-num">${signed2(p2.gain)}</span> in ${plan.options.days} days \xB7 ${coins8(p2.endRate)}/day at the end \xB7 score ${coins8(p2.score)}${cautious ? ` \xB7 <span class="mwia-dim">${cautious}</span>` : ""}</summary>
          ${stepsHtml(p2)}</details>`;
    }).join("");
  }
  function aboutHtml(plan) {
    const o2 = plan.options;
    const unknown = plan.unknownSales?.length ? ` No sales are known yet for ${plan.unknownSales.slice(0, 5).map((h3) => esc(itemName(h3))).join(", ")}${plan.unknownSales.length > 5 ? ", \u2026" : ""}: the market takes any number of them.` : "";
    return `<details><summary class="mwia-dim">How the plan is worked out</summary><p class="mwia-dim">
      Time goes in ${o2.blockHours}-hour blocks. In each the character runs the job that earns the most \u2013 or, while a plan trains a skill to a level where a job or tool unlocks, that skill's job with the most gold or the fastest XP; when your coins or the market cut a job short, the rest of the block goes to the next best one queued behind it (two jobs at most, none under an hour).
      Prices are the usual ones, not today's: the week's median ask to buy and to list at (never above 1.5\xD7 the usual bid), the median bid as the floor.
      The market takes ${Math.round(o2.marketShare * 100)}% of what sells of an item a day: the rest waits in stock and sells first in later blocks; the same share caps what you can buy of a material.
      A better tool for the skill you work is bought when its extra gold over the days left (on a detour: until it ends) pays for it (less what it sells for again); the old one is sold at the bid. Any tier your level allows, at +0 or at a +level the market has had for sale this week (at its usual ask); it has to pay back before the skill reaches the next tier when that tier is for sale at the same +level or higher \u2013 enhancing it yourself isn't weighed.
      Each skill is worked in a loadout of its own: of each slot, the clothes, jewellery, charm or cape you own (worn or in the inventory) that earn the most on its best job \u2013 switch loadouts in the game as the plan switches skill. A piece for the skill you work is bought the same way as a tool, also at a +level (a lower level of the same piece is sold); what it replaces is kept for other skills. The pouch and task badges stay as they are.
      The skill's house room goes up a level when its extra gold over the days left pays for the coins and materials (at the ask, no more of a material than the market sells in a week); it can't be sold again.
      Worth = coins + tools and clothes at the bid for their +level + stock (at the bid for up to a day of sales, the shop price for the rest). The score adds ${o2.levelDays} days of what the character earns a day at the end, so levels and house rooms count.
      Prices stay as they are now for the whole plan, and so do the community buffs${plan.community ? " \u2013 the best plans are also run without them (\u201Cno community buffs\u201D)" : ""}.
      Plans compared: up to three detours \u2013 a skill to a level where a job, tool or clothes unlock (or a multiple of 5), earning in it or at its fastest XP \u2013 and then one skill to the end. Each skill is first run on its own to the end; any such plan is then valued by looking up those runs (a search over hundreds of thousands of plans), and the best few dozen are simulated as they are, with earning the most every block and keeping to each skill. A purchase made on a detour pays only until the detour ends. Of plans within 0.25% of the best, the simplest is shown first. Gathering and production only \u2013 no Enhancing, Alchemy or combat yet, and materials are bought, not gathered yourself.${unknown}
    </p></details>`;
  }
  function renderHorizon(settings2) {
    const st = horizonState();
    let html = `<h3>\u{1F4C8} Plan ${horizonOptions(settings2).days} days ahead</h3>`;
    if (!st.linked) return html + `<p>The plan is worked out on your own Pi, a few times a day: link this browser to it first (the price box in the marketplace, <i>Chart and details</i>; setup in <code>pi/README.md</code>).</p>`;
    if (st.piOk && !st.makesPlans) return html + `<p>Your Pi doesn't make plans: it needs <code>MWIA_ORDERS=1</code> in <code>pi/.env</code> and the newest server (<code>git pull && docker compose up -d --build</code> in <code>pi/</code>).</p>`;
    html += settingsHtml(settings2) + statusHtml2(st, settings2);
    const plan = st.plan;
    if (!plan?.plans?.length) return html + `<p>No plan yet. ${st.makesPlans ? "Your character goes to the Pi with the next sync (every 15 minutes) and the plan comes 10 minutes later \u2013 or tap <b>\u25B6 Plan now</b>." : "Waiting for the Pi\u2026"}</p>`;
    markHorizonSeen();
    const best = plan.plans[plan.best];
    html += `<div class="mwia-horizon-best"><p>\u{1F4C8} <b>${esc(best.name)}</b>: ${signed2(best.gain)} in ${plan.options.days} days, then ${coins8(best.endRate)}/day.</p>${firstHtml(plan, best)}${compareHtml(plan)}</div>`;
    html += `<h3>Plans</h3>${plansHtml(plan)}${aboutHtml(plan)}`;
    return html;
  }

  // src/ui.js
  var SETTINGS_KEY = "mwia-settings";
  var DEFAULT_SETTINGS = { goldWeight: 0, countLevels: false, combatGear: "auto", combatStyle: "current", acceptRareDeaths: false, accuracy: "normal", budget: 2e6, spending: "balanced", maxTier: 1, zone: "auto", skillingSkill: "all", skillingSellAt: "ask", skillingTeas: "current", skillingMode: "away", skillingGold: 100, labyCoffee: "slots", labyFood: "slots", labyLevel: 30, horizonDays: 30, horizonLevelDays: 7 };
  var SKILL_NAMES = {
    stamina: "Stamina",
    intelligence: "Intelligence",
    attack: "Attack",
    melee: "Melee",
    defense: "Defense",
    ranged: "Ranged",
    magic: "Magic"
  };
  var SLOT_NAMES = {
    main_hand: "Weapon",
    two_hand: "Two-hand",
    off_hand: "Off-hand",
    head: "Head",
    body: "Body",
    legs: "Legs",
    feet: "Feet",
    hands: "Hands",
    neck: "Neck",
    earrings: "Earrings",
    ring: "Ring",
    back: "Back",
    pouch: "Pouch",
    charm: "Charm"
  };
  var ui = {
    root: null,
    tab: "overview",
    settings: loadSettings(),
    pool: null,
    busy: false,
    zoneResults: null,
    zoneStarter: null,
    // the weapon zones were simulated with when fighting as another style
    upgradeRaw: null,
    // simulated upgrades, independent of the XP/gold goal
    upgradeResult: null,
    // upgradeRaw rated for the current goal
    plan: null,
    verified: null,
    error: null,
    progress: null,
    workerSource: null,
    win: null,
    notice: null,
    cartItems: /* @__PURE__ */ new Map(),
    // button id -> items for the MWITools cart (rebuilt on every render)
    skillingLoad: null,
    // { loading, error } while the Skilling tab fetches game data and prices
    returnRow: null,
    // Skilling row to scroll back to when the panel opens again
    marketWatch: null,
    // timer waiting for the marketplace to close
    marketLoading: null,
    // promise while the Market tab loads game data and prices
    launcher: null,
    // the 🧭 button
    labResult: null,
    // Labyrinth: win rate by room level against each monster
    labImprove: null,
    // Labyrinth: what takes you further
    labBuild: null,
    // Labyrinth: a loadout built for one attack style's rooms
    labSetups: null
    // Labyrinth: the loadouts the last check compared
  };
  var MARKET_PANEL = '[class*="MarketplacePanel_marketplacePanel"]';
  var MARKET_SHOW_MS = 8e3;
  var MARKET_POLL_MS = 300;
  function loadSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(ui.settings));
    } catch {
    }
  }
  var int = (n5) => Math.round(n5).toLocaleString("en-US");
  var dec3 = (n5, d = 1) => n5.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  var pct5 = (n5) => (n5 >= 0 ? "+" : "") + dec3(n5 * 100, 1) + "%";
  var HOURS_PER_DAY3 = 24;
  var perDay = (perHour) => perHour * HOURS_PER_DAY3;
  function coins9(n5) {
    if (n5 === null || n5 === void 0) return "\u2013";
    const abs = Math.abs(n5);
    if (abs >= 1e9) return dec3(n5 / 1e9, 2) + "B";
    if (abs >= 1e6) return dec3(n5 / 1e6, abs >= 1e7 ? 1 : 2) + "M";
    if (abs >= 1e4) return dec3(n5 / 1e3, 0) + "k";
    return int(n5);
  }
  function gearLabel(gear) {
    if (!gear) return '<span class="mwia-dim">empty</span>';
    return esc(itemName(gear.hrid)) + (gear.enhancementLevel ? ` <span class="mwia-enh">+${gear.enhancementLevel}</span>` : "");
  }
  function zoneLabel(zone) {
    return esc(actionName(zone.zoneHrid)) + (zone.tier ? ` <span class="mwia-tier">T${zone.tier}</span>` : "");
  }
  function deathBadge(deaths) {
    if (deaths === 0) return '<span class="mwia-ok" title="Never died in the simulation">\u2714 safe</span>';
    if (deaths <= deathLimit(ui.settings)) return `<span class="mwia-ok" title="Deaths per hour \u2013 within what you accept">\u2714 ${dec3(deaths, 2)}/h</span>`;
    if (deaths < 1) return `<span class="mwia-warn" title="Deaths per hour">\u26A0 ${dec3(deaths, 2)}/h</span>`;
    return `<span class="mwia-bad" title="Deaths per hour">\u2716 ${dec3(deaths, 1)}/h</span>`;
  }
  var signed3 = (text, n5) => (n5 >= 0 ? "+" : "\u2212") + text(Math.abs(n5));
  var focusText = (gold) => gold === 0 ? "XP only" : gold === 100 ? "Gold only" : `${100 - gold}% XP \xB7 ${gold}% gold`;
  var countingLevels = () => !!ui.settings.countLevels && Array.isArray(getClientData()?.levelExperienceTable);
  var xpLabel = () => countingLevels() ? "Levels/day" : "Combat XP/h";
  var xpNum = (v) => countingLevels() ? dec3(perDay(v), 2) : int(v);
  function currentProfile() {
    const data = getClientData();
    if (!state.character || !data) return null;
    const profile = buildProfile(state.character, state.items, data);
    return applyLoadout(profile, chooseLoadout(state.character, ui.settings.combatGear), state.items, data);
  }
  async function ensureReady() {
    const data = await loadClientData(ui.win);
    await loadPrices();
    if (!state.character) throw new Error("No character data yet. Reload the game page (F5) with the script enabled.");
    if (!ui.pool) {
      const size = Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, isTouch() ? 4 : 8));
      ui.pool = new SimPool(ui.workerSource, engineTables(), size);
      await ui.pool.start();
    }
    return data;
  }
  async function runTask(task) {
    if (ui.busy) return;
    ui.busy = true;
    ui.error = null;
    ui.progress = { done: 0, total: 0, label: "Preparing\u2026" };
    render3();
    try {
      await ensureReady();
      await task();
    } catch (error) {
      if (error.message !== "Cancelled") {
        console.error("[MWI Advisor]", error);
        ui.error = error.message || String(error);
      }
    } finally {
      ui.busy = false;
      ui.progress = null;
      render3();
    }
  }
  function progress(label3) {
    return (done2, total) => {
      ui.progress = { done: done2, total, label: label3 };
      renderProgress();
    };
  }
  function runSettings() {
    const accuracy = ACCURACY[ui.settings.accuracy] || ACCURACY.normal;
    return { ...accuracy, budget: Number(ui.settings.budget) || 0, maxTier: Number(ui.settings.maxTier) || 0 };
  }
  function fightingProfile() {
    const profile = currentProfile();
    const style = ui.settings.combatStyle;
    if (!profile || !STYLE_NAMES[style]) return { profile, starter: null };
    const switched = switchStyle(profile, style, Number(ui.settings.budget) || 0);
    if (switched.missing) throw new Error(`No ${STYLE_NAMES[style]} weapon you can wear is for sale within your budget.`);
    return switched;
  }
  async function doZones() {
    const { profile, starter } = fightingProfile();
    ui.zoneStarter = starter;
    ui.zoneResults = await analyzeZones(ui.pool, profile, runSettings(), progress("Simulating zones"));
  }
  function chosenZone(profile) {
    const selected = ui.settings.zone;
    if (selected && selected !== "auto") {
      const [zoneHrid, tier] = selected.split("#");
      return { zoneHrid, tier: Number(tier) || 0 };
    }
    const best = pickBestZone(ui.zoneResults, ui.settings);
    if (best) return best.zone;
    return profile.currentZone || null;
  }
  function loadoutProfile(loadout) {
    const data = getClientData();
    if (!state.character || !data) return null;
    return applyLoadout(buildProfile(state.character, state.items, data), loadout, state.items, data);
  }
  async function adviseLoadout(loadout, zone, onProgress) {
    if (ui.busy) throw new Error("The advisor is busy with another analysis.");
    let result = null;
    await runTask(async () => {
      const profile = loadoutProfile(loadout);
      if (!profile) throw new Error("No character data yet.");
      const label3 = (round) => `Loadout ${loadout.name || ""} for ${actionName(zone.zoneHrid) || zone.zoneHrid}, round ${round}`;
      result = await analyzeLoadout(ui.pool, profile, zone, { ...ui.settings, ...runSettings(), ...ACCURACY.fast }, (done2, total, round) => {
        progress(label3(round))(done2, total);
        onProgress(done2, total, round);
      });
    });
    if (!result) throw new Error(ui.error || "Cancelled");
    return result;
  }
  function labyrinthSetups() {
    const data = getClientData();
    if (!state.character || !data) return [];
    const base = buildProfile(state.character, state.items, data);
    const setups = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (id, name, profile) => {
      const key2 = JSON.stringify([profile.equipment, profile.abilities, profile.abilityTriggers]);
      if (seen.has(key2)) return;
      seen.add(key2);
      setups.push({ id, name, profile });
    };
    for (const loadout of [...combatLoadouts(state.character), ...labyrinthLoadouts(state.character)]) {
      add(loadout.id, loadout.name || "Loadout", applyLoadout(base, loadout, state.items, data));
    }
    add("equipped", "Equipped now", base);
    return setups;
  }
  async function doLabyrinth() {
    ui.labImprove = null;
    ui.labSetups = labyrinthSetups();
    ui.labResult = await analyzeLabyrinth(ui.pool, ui.labSetups, getClientData(), ui.settings, state.character, progress("Simulating Labyrinth rooms"));
    rememberLabyrinth(ui.labResult);
    labyrinthCheckChanged();
  }
  async function doLabImprove() {
    if (!ui.labResult) await doLabyrinth();
    ui.labImprove = await analyzeImprovements(ui.pool, ui.labSetups, getClientData(), ui.settings, ui.labResult, progress("Testing improvements"));
  }
  async function doLabBuild() {
    const style = buildStyleSetting(ui.settings);
    ui.labBuild = null;
    ui.labBuild = await buildLoadout(ui.pool, currentProfile(), getClientData(), ui.settings, {
      style,
      budget: Number(ui.settings.budget) || 0,
      enhanceCost: enhanceCostFor(),
      crates: chosenCrates(ui.settings, state.character)
    }, progress(`Building a ${style} loadout`));
  }
  function renderLabyrinthTab() {
    const data = getClientData();
    if (!state.character) return `<p>The script hasn't seen your character yet. <b>Reload the page (F5)</b> with the script enabled.</p>`;
    if (!data) return `<p>The game data loads with the first analysis.</p><button class="mwia-btn" data-action="laby-check" ${ui.busy ? "disabled" : ""}>Check the rooms</button>`;
    const setups = ui.labSetups || labyrinthSetups();
    return renderLabyrinth({
      lab: ui.labResult,
      improve: ui.labImprove,
      build: ui.labBuild,
      profileOf: (id) => setups.find((s2) => s2.id === id)?.profile || null,
      data,
      settings: ui.settings,
      busy: ui.busy,
      settingsHtml: settingsHtml2,
      slotted: { coffee: slottedCrate(state.character, "coffee"), food: slottedCrate(state.character, "food") },
      setupsNote: `<p class="mwia-dim">Loadouts: ${setups.map((s2) => `<b>${esc(s2.name)}</b>`).join(", ")}${setups.length < 2 ? " \u2013 save a loadout per combat style in the game to compare them here" : ""}.</p>`,
      cartButton: cartButton4,
      coins: coins9,
      attempts: attemptsHtml(attemptSummary(), labyrinthAttempts().slice(-15).reverse())
    });
  }
  function rerateUpgrades() {
    if (!ui.upgradeRaw) return;
    ui.upgradeResult = rateUpgrades(ui.upgradeRaw, ui.settings);
    ui.plan = buildPlan(ui.upgradeResult, Number(ui.settings.budget) || 0, ui.settings.spending);
    ui.verified = null;
    saveCombatSetup();
    saveTriggerAdvice(ui.plan);
  }
  var ADVICE_KEY = "mwia-trigger-advice";
  function saveTriggerAdvice(plan) {
    const advice = {};
    for (const t4 of plan?.triggers || []) advice[t4.hrid] = { triggers: t4.triggers };
    for (const p2 of plan?.picks || []) if (p2.kind === "ability" && p2.triggers) advice[p2.hrid] = { triggers: p2.triggers };
    try {
      localStorage.setItem(ADVICE_KEY, JSON.stringify(advice));
    } catch {
    }
    ui.triggerAdvice = advice;
  }
  function loadTriggerAdvice() {
    if (ui.triggerAdvice) return ui.triggerAdvice;
    try {
      ui.triggerAdvice = JSON.parse(localStorage.getItem(ADVICE_KEY) || "{}") || {};
    } catch {
      ui.triggerAdvice = {};
    }
    return ui.triggerAdvice;
  }
  function saveCombatSetup() {
    const raw = ui.upgradeRaw;
    const plan = ui.plan;
    if (!raw || !plan) return;
    const target = applyPlan(raw.baseProfile, { picks: [], drink: plan.drink, food: plan.food });
    const slots = slotCounts(raw.baseProfile, getClientData());
    const perHour = { ...raw.base.consumables, ...plan.drink?.result?.consumables || {}, ...plan.food?.result?.consumables || {}, ...ui.verified?.planned?.consumables || {} };
    rememberCombatSetup(raw.zone, { drinks: target.drinks.slice(0, slots.drinks), food: target.food.slice(0, slots.food), perHour, encountersPerHour: raw.base.encounters });
  }
  function enhanceCostFor() {
    const data = getClientData();
    try {
      const who = skillingCharacter(state.character, state.items, data);
      const market = skillingMarket("bid");
      return (hrid, starts) => selfEnhanceCosts(hrid, who, data, market, starts);
    } catch (error) {
      console.warn("[MWI Advisor] enhancing costs unavailable", error);
      return null;
    }
  }
  async function doRefine() {
    await refineUncertain(ui.pool, ui.upgradeRaw, ui.settings, progress("Re-running uncertain suggestions"));
    rerateUpgrades();
  }
  var hasPlan = (plan) => !!(plan && (plan.picks.length || plan.drink || plan.food || plan.order || plan.triggers?.length));
  async function doUpgrades(scope = "all") {
    const { profile, starter } = fightingProfile();
    if (ui.settings.zone === "auto" && !ui.zoneResults) await doZones();
    const zone = chosenZone(profile);
    if (!zone) throw new Error("Pick a zone first.");
    const run = runSettings();
    const settings2 = { ...run, budget: Math.max(0, run.budget - (starter?.cost || 0)), starter, enhanceCost: enhanceCostFor(), scope };
    ui.upgradeRaw = await analyzeUpgrades(ui.pool, profile, zone, settings2, progress("Testing upgrades"), progress("Re-running uncertain suggestions"));
    rerateUpgrades();
    if (hasPlan(ui.plan)) {
      ui.verified = await verifyPlan(ui.pool, profile, ui.plan, zone, settings2, progress("Checking the shopping list"));
      saveCombatSetup();
    }
  }
  function render3() {
    if (!ui.root) return;
    const body = ui.root.querySelector(".mwia-body");
    ui.root.querySelectorAll(".mwia-tab").forEach((t4) => t4.classList.toggle("mwia-active", t4.dataset.tab === ui.tab));
    ui.root.querySelector(".mwia-status").innerHTML = statusLine();
    ui.cartItems = /* @__PURE__ */ new Map();
    let html = "";
    if (ui.error) html += `<div class="mwia-error">${esc(ui.error)}</div>`;
    if (ui.notice && ["upgrades", "skilling", "market", "labyrinth"].includes(ui.tab)) html += noticeHtml(ui.notice);
    if (ui.busy) html += progressHtml();
    if (ui.tab === "overview") html += renderOverview();
    else if (ui.tab === "zones") html += renderZones();
    else if (ui.tab === "upgrades") html += renderUpgrades();
    else if (ui.tab === "skilling") html += renderSkillingTab();
    else if (ui.tab === "horizon") html += renderHorizon(ui.settings);
    else if (ui.tab === "market") html += renderMarketTab();
    else if (ui.tab === "labyrinth") html += renderLabyrinthTab();
    else html += renderGuide();
    body.innerHTML = html;
    if (ui.showNotice) {
      ui.showNotice = false;
      body.scrollTop = 0;
    }
    labelTableCells(body);
    updateAlertDot();
  }
  function renderMarketTab() {
    if (!state.character) {
      return `<p>The script hasn't seen your character yet. It reads it when the game connects, so <b>reload the page (F5)</b> with the script enabled.</p>`;
    }
    if (getClientData() && pricesAge() !== null) return renderMarket();
    if (!ui.marketLoading) {
      ui.marketLoading = Promise.all([loadClientData(ui.win), loadPrices()]).catch((error) => ui.error = error.message || String(error)).finally(() => {
        ui.marketLoading = null;
        if (ui.tab === "market") render3();
      });
    }
    return `<p>Loading the game data and market prices\u2026</p>`;
  }
  function updateAlertDot() {
    if (!ui.launcher) return;
    const alerts = marketAlerts();
    const news = horizonNews();
    ui.launcher.classList.toggle("mwia-has-alert", alerts > 0);
    ui.launcher.classList.toggle("mwia-has-news", news);
    const lines = [alerts ? `${alerts} market order${alerts === 1 ? "" : "s"} behind a wall of better offers` : "", news ? "a new \u{1F4C8} plan" : ""].filter(Boolean);
    ui.launcher.title = lines.length ? `MWI Advisor \u2013 ${lines.join("; ")}` : "MWI Advisor";
  }
  var MARKET_REFRESH_MS = 10 * 60 * 1e3;
  var MARKET_FIRST_CHECK_MS = 60 * 1e3;
  async function refreshMarket() {
    if (!(state.character?.myMarketListings || []).length) return;
    try {
      await loadClientData(ui.win);
      await loadPrices(true);
    } catch {
    }
    updateAlertDot();
    if (!ui.root.classList.contains("mwia-hidden") && !ui.busy && ui.tab === "market") render3();
  }
  function statusLine() {
    if (!state.character) return '<span class="mwia-warn">Waiting for character data \u2013 reload the page if this stays.</span>';
    const age = pricesAge();
    const prices2 = age === null ? "prices load on first analysis" : `prices ${Math.round(age / 6e4)} min old`;
    return `${esc(state.character.character?.name || "")} \xB7 ${prices2}`;
  }
  function progressHtml() {
    const p2 = ui.progress || { done: 0, total: 0, label: "" };
    const share = p2.total ? 100 * p2.done / p2.total : 0;
    return `<div class="mwia-progress"><div class="mwia-progress-label"><span>${esc(p2.label)} ${p2.total ? `${p2.done}/${p2.total}` : ""}</span>
        <button class="mwia-link" data-action="cancel">Cancel</button></div>
        <div class="mwia-bar"><div style="width:${share}%"></div></div></div>`;
  }
  function renderProgress() {
    const node = ui.root?.querySelector(".mwia-progress");
    if (!node) return render3();
    const p2 = ui.progress;
    node.querySelector(".mwia-progress-label span").textContent = `${p2.label} ${p2.total ? `${p2.done}/${p2.total}` : ""}`;
    node.querySelector(".mwia-bar div").style.width = `${p2.total ? 100 * p2.done / p2.total : 0}%`;
  }
  function settingsHtml2(fields) {
    const s2 = ui.settings;
    const parts = [];
    if (fields.includes("focus")) {
      const gold = Math.round((Number(s2.goldWeight) || 0) * 100);
      parts.push(`<label class="mwia-focus" title="What to optimise for: XP per hour, gold (loot minus food/drink cost) per hour, or a mix. Changing it re-ranks instantly \u2013 no new simulation needed.">
            Focus: <span class="mwia-focus-text">${focusText(gold)}</span>
            <span class="mwia-focus-row">XP <input type="range" min="0" max="100" step="10" value="${gold}" data-setting="goldWeight"> Gold</span></label>`);
    }
    if (fields.includes("levels")) {
      parts.push(`<label title="Rank by how many levels the XP gives instead of by XP: XP in a low skill buys many more levels than in a high one, so this is the fastest way up in total level. Counted over a day of training.">
            Total level <span class="mwia-focus-row"><input type="checkbox" data-setting="countLevels" ${s2.countLevels ? "checked" : ""}> Count levels, not XP</span></label>`);
    }
    if (fields.includes("gear")) {
      const loadouts = combatLoadouts(state.character);
      if (loadouts.length) {
        const auto = chooseLoadout(state.character, "auto");
        const options = [
          ["auto", `Default loadout (${auto?.name || "Loadout"})`],
          ["equipped", "Equipped now"],
          ...loadouts.map((l2) => [l2.id, `Loadout: ${l2.name || "Loadout"}${l2.isDefault ? " \u2605" : ""}`])
        ];
        parts.push(`<label title="The gear, abilities, food and drinks to work from: a combat loadout you saved in the game, or what you wear now. Gear you own but the loadout doesn't wear counts as in your inventory.">
            Gear from <select data-setting="combatGear">${options.map(([k, v]) => `<option value="${esc(k)}" ${String(s2.combatGear) === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`);
      }
    }
    if (fields.includes("style")) {
      const profile = currentProfile();
      const now2 = profile && getClientData() ? STYLE_NAMES[weaponStyle(profile, getClientData())] : null;
      const options = [["current", `Current weapon${now2 ? ` (${now2})` : ""}`], ...Object.entries(STYLE_NAMES)];
      parts.push(`<label title="The style to fight with. Another style than your weapon's starts from the best weapon for it you own, or the cheapest you can wear (it goes on the shopping list); better weapons of that style are then tested as upgrades.">
            Fight as <select data-setting="combatStyle">${options.map(([k, v]) => `<option value="${k}" ${s2.combatStyle === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>`);
    }
    if (fields.includes("accuracy")) {
      parts.push(`<label>Accuracy <select data-setting="accuracy">${Object.entries(ACCURACY).map(([k, v]) => `<option value="${k}" ${s2.accuracy === k ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>`);
    }
    if (fields.includes("risk")) {
      parts.push(`<label title="A death costs 150 s of waiting, which is already counted in XP/h and profit. Allowing rare deaths lets harder, more rewarding zones and upgrades be recommended.">
            Deaths <span class="mwia-focus-row"><input type="checkbox" data-setting="acceptRareDeaths" ${s2.acceptRareDeaths ? "checked" : ""}> Accept rare deaths (\u2264 ${dec3(0.5, 1)}/h)</span></label>`);
    }
    if (fields.includes("maxTier")) {
      parts.push(`<label title="Difficulty tier. Higher tiers give more XP but are more dangerous.">Max tier <select data-setting="maxTier">${[0, 1, 2, 3, 4, 5].map((t4) => `<option value="${t4}" ${Number(s2.maxTier) === t4 ? "selected" : ""}>T${t4}</option>`).join("")}</select></label>`);
    }
    if (fields.includes("budget")) {
      parts.push(`<label title="E.g. 500k, 2M, 1.5M">Budget (coins) <input data-setting="budget" type="text" inputmode="decimal" size="8" value="${coinsInput(Number(s2.budget) || 0)}"></label>`);
    }
    if (fields.includes("spending")) {
      parts.push(`<label title="How much a purchase must give back. Frugal: at least +10% XP/h per 1M coins, Balanced: +3%, All in: anything within budget.">Spending <select data-setting="spending">${Object.entries(SPENDING).map(([k, v]) => `<option value="${k}" ${s2.spending === k ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>`);
    }
    if (fields.includes("zone")) {
      const options = ['<option value="auto">Automatic (best safe zone)</option>'];
      for (const zone of getClientData() ? combatZones() : []) {
        for (let t4 = 0; t4 <= Math.min(5, zone.maxDifficulty ?? 0); t4++) {
          const value = `${zone.hrid}#${t4}`;
          options.push(`<option value="${value}" ${s2.zone === value ? "selected" : ""}>${esc(zone.name)}${t4 ? " T" + t4 : ""}</option>`);
        }
      }
      parts.push(`<label>Zone <select data-setting="zone">${options.join("")}</select></label>`);
    }
    return `<div class="mwia-settings">${parts.join("")}</div>`;
  }
  function renderOverview() {
    const data = getClientData();
    if (!state.character) {
      return `<p>The script hasn't seen your character yet. It reads it when the game connects, so <b>reload the page (F5)</b> with the script enabled.</p>`;
    }
    if (!data) {
      return `<p>Game data isn't loaded yet.</p><button class="mwia-btn" data-action="load">Load</button>`;
    }
    const profile = currentProfile();
    const slots = slotCounts(profile, data);
    const levels = profile.levels;
    const tips = overviewTips(profile, slots, data);
    const levelRows = COMBAT_SKILLS.map((s2) => `<tr><td>${SKILL_NAMES[s2]}</td><td class="mwia-num">${levels[s2]}</td></tr>`).join("");
    const gearRows = Object.keys(SLOT_NAMES).filter((t4) => t4 !== "two_hand" || profile.equipment.two_hand).filter((t4) => t4 !== "main_hand" || !profile.equipment.two_hand).map((t4) => `<tr><td>${SLOT_NAMES[t4]}</td><td>${gearLabel(profile.equipment[t4])}</td></tr>`).join("");
    const abilityRows = [];
    for (let i = 1; i <= Math.max(slots.abilities, 1); i++) {
      const a = profile.abilities[i];
      abilityRows.push(
        `<li>${i <= slots.abilities ? a ? `${esc(abilityName(a.hrid))} <span class="mwia-dim">lvl ${a.level}</span>` : '<span class="mwia-warn">empty slot</span>' : '<span class="mwia-dim">locked</span>'}</li>`
      );
    }
    const consumableList = (list, count3) => Array.from({ length: count3 }, (_, i) => `<li>${list[i] ? esc(itemName(list[i])) : '<span class="mwia-warn">empty slot</span>'}</li>`).join("");
    return `
    ${combatLoadouts(state.character).length ? settingsHtml2(["gear"]) : ""}${loadoutNote(profile)}
    <div class="mwia-grid">
      <section><h3>Levels</h3>
        <table class="mwia-table">${levelRows}
        <tr class="mwia-sum"><td>Combat level</td><td class="mwia-num">${dec3(combatLevel(levels), 1)}</td></tr></table></section>
      <section><h3>Equipment</h3><table class="mwia-table">${gearRows}</table></section>
      <section><h3>Abilities (${slots.abilities} slot${slots.abilities === 1 ? "" : "s"})</h3><ol>${abilityRows.join("")}</ol>
        <h3>Food (${slots.food})</h3><ul>${consumableList(profile.food, slots.food)}</ul>
        <h3>Drinks (${slots.drinks})</h3><ul>${consumableList(profile.drinks, slots.drinks)}</ul></section>
    </div>
    ${totalLevelHtml(profile, data)}
    <h3>Tips for your character</h3>
    <ul class="mwia-tips">${tips.map((t4) => `<li class="mwia-tip-${t4.level}">${t4.html}</li>`).join("")}</ul>
    <p class="mwia-dim">Next step: the <b>Where to fight</b> tab, then <b>Upgrades</b>.</p>`;
  }
  function loadoutNote(profile) {
    if (!profile?.loadout) return "";
    const missing = profile.loadout.missing;
    return `<p class="mwia-dim">Working from your loadout <b>${esc(profile.loadout.name)}</b>, not the gear you wear now.</p>${missing.length ? `<p class="mwia-warn">\u26A0 Not in your inventory, so left empty: ${missing.map(gearLabel).join(", ")}.</p>` : ""}`;
  }
  var STYLE_WEAPONS = { magic: "a staff", ranged: "a bow or crossbow", melee: "a sword, mace or spear" };
  function overviewTips(profile, slots, data) {
    const tips = [];
    const weapon = weaponOf(profile);
    const style = weaponStyle(profile, data);
    if (!weapon) {
      tips.push({ level: "bad", html: "You have no weapon. Pick a style under <b>Fight as</b> in <b>Upgrades</b>: it finds a weapon (e.g. a Wooden Bow, Cheese Sword or Wooden Staff) and what to buy next." });
    }
    const emptyAbilities = [];
    for (let i = 1; i <= slots.abilities; i++) if (!profile.abilities[i]) emptyAbilities.push(i);
    if (emptyAbilities.length) {
      tips.push({ level: "bad", html: `You have ${emptyAbilities.length} empty ability slot(s). Abilities add a lot of damage \u2013 see <b>Upgrades</b> for which one pays off.` });
    }
    const requirements = data.abilitySlotsLevelRequirementList || [];
    const nextSlotLevel = requirements.slice(2).find((lvl2) => lvl2 > profile.levels.intelligence);
    if (nextSlotLevel && nextSlotLevel - profile.levels.intelligence <= 8) {
      tips.push({ level: "info", html: `At Intelligence ${nextSlotLevel} you unlock another ability slot (you're at ${profile.levels.intelligence}).` });
    }
    if (!profile.food.slice(0, slots.food).some(Boolean)) {
      tips.push({ level: "bad", html: "You have no food for combat. Food is eaten automatically when you lose HP and keeps you from dying." });
    }
    if (profile.drinks.slice(0, slots.drinks).some((d) => !d)) {
      tips.push({ level: "warn", html: "You have an empty drink slot. Coffee gives a 5-minute buff \u2013 <b>Upgrades</b> shows whether it pays off for you." });
    }
    const accuracy = style === "melee" ? null : style + "Accuracy";
    const badArmor = accuracy ? Object.entries(profile.equipment).filter(([type]) => !["main_hand", "two_hand"].includes(type)).filter(([, gear]) => (data.itemDetailMap[gear.hrid]?.equipmentDetail?.combatStats?.[accuracy] || 0) < 0).map(([, gear]) => itemName(gear.hrid)) : [];
    if (badArmor.length) {
      tips.push({ level: "warn", html: `${badArmor.map(esc).join(", ")} lower(s) your ${STYLE_NAMES[style].toLowerCase()} accuracy \u2013 check <b>Upgrades</b> for armour that suits your style.` });
    }
    const trained = styleSkills(style, data);
    const lowest = [...trained].sort((a, b) => profile.levels[a] - profile.levels[b])[0];
    const charmFocus = profile.equipment.charm && data.itemDetailMap[profile.equipment.charm.hrid]?.equipmentDetail?.combatStats?.focusTraining?.split("/").pop();
    if (!profile.equipment.charm) {
      tips.push({ level: "info", html: `No charm. A focus charm (e.g. Trainee ${SKILL_NAMES[lowest]} Charm) sends 70% of your combat XP to one skill instead of splitting it over ${trained.map((k) => SKILL_NAMES[k]).join(", ")}.
          For total level, focus the lowest: <b>${SKILL_NAMES[lowest]}</b> (${profile.levels[lowest]}). <b>Upgrades</b> with <i>Count levels</i> measures it.` });
    } else if (charmFocus && profile.levels[charmFocus] - profile.levels[lowest] >= 10) {
      tips.push({ level: "info", html: `Your charm focuses ${SKILL_NAMES[charmFocus] || charmFocus} (${profile.levels[charmFocus]}). For total level a ${SKILL_NAMES[lowest]} charm gives more: ${SKILL_NAMES[lowest]} is only ${profile.levels[lowest]}.` });
    }
    const untrained = Object.keys(STYLE_NAMES).filter((k) => k !== style && profile.levels[k] + 15 <= profile.levels[style]);
    for (const k of untrained) {
      tips.push({ level: "info", html: `${SKILL_NAMES[k]} is only level ${profile.levels[k]}: its first levels cost very little XP. Fighting with ${STYLE_WEAPONS[k]} for a while is a quick way up in total level \u2013
          pick <b>Fight as: ${STYLE_NAMES[k]}</b> and <i>Count levels</i> in <b>Upgrades</b>.` });
    }
    if (!tips.length) tips.push({ level: "ok", html: "No obvious gaps. Run the zone and upgrade analyses to fine-tune." });
    return tips;
  }
  var SKILLING_NAMES = (hrid) => {
    const name = hrid.split("/").pop();
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  function totalLevelHtml(profile, data) {
    const table = data.levelExperienceTable;
    const goal = nextPouchGoal(profile.totalLevel, data);
    let html = `<h3>Total level ${profile.totalLevel}</h3>`;
    if (goal) html += `<p>${goal.level - profile.totalLevel} levels to <b>${goal.level}</b>, which unlocks the <b>${esc(itemName(goal.hrid))}</b> (more food and drink slots).</p>`;
    if (!Array.isArray(table)) return html;
    const rows = Object.entries(profile.allLevels).filter(([hrid]) => hrid !== "/skills/total_level").map(([hrid, level]) => ({ hrid, level, need: xpToNextLevel(table, experienceOf(table, profile.allExperience?.[hrid], level), level) })).filter((r) => r.need !== null).sort((a, b) => a.need - b.need);
    html += `<details class="mwia-skill-sec"><summary>Cheapest levels: XP to the next level, per skill</summary><table class="mwia-table">
      <thead><tr><th>Skill</th><th class="mwia-num">Level</th><th class="mwia-num">XP to next</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(SKILL_NAMES[r.hrid.split("/").pop()] || SKILLING_NAMES(r.hrid))}</td><td class="mwia-num">${r.level}</td><td class="mwia-num">${int(r.need)}</td></tr>`).join("")}
      </tbody></table>
      <p class="mwia-dim">Tick <i>Count levels, not XP</i> in Where to fight, Upgrades or Skilling to rank by levels gained.</p></details>`;
    html += `<p><button class="mwia-btn" data-action="export">\u{1F9ED} Export for chat</button> <span class="mwia-dim">A text file with your character, inventory, orders and the advice, to paste into a chat. The same button is under the game's inventory.</span></p>`;
    return html;
  }
  function exportContext() {
    const sections = [];
    const textOf = (html, selector) => {
      const box = document.createElement("div");
      box.innerHTML = html;
      return [...box.querySelectorAll(selector)].map((node) => (node.tagName === "TR" ? [...node.children].map((cell) => cell.textContent.trim()).join(" | ") : node.textContent).replace(/\s+/g, " ").trim()).filter(Boolean);
    };
    const attempt4 = (title, lines) => {
      try {
        const got = lines();
        if (got.length) sections.push({ title, lines: got });
      } catch (error) {
        sections.push({ title, lines: [`(not available: ${error?.message || error})`] });
      }
    };
    attempt4("Skilling: best now", () => getClientData() ? skillingExportLines(ui.settings) : []);
    if (ui.zoneResults) attempt4("Where to fight (last run)", () => textOf(renderZones(), ".mwia-reco, tbody tr").slice(0, 16));
    if (ui.labResult || ui.labBuild) attempt4("Labyrinth (last run)", () => labyrinthExportLines(ui.labResult, ui.labImprove, ui.labBuild, ui.settings));
    if (labyrinthAttempts().length) {
      attempt4("Labyrinth attempts", () => [
        ...attemptSummary().map((x) => `${x.type === "combat" ? x.what : x.what + " (skilling)"} Lv.${x.minLevel ?? "\u2013"}\u2013${x.maxLevel ?? "\u2013"}: won ${x.wins}/${x.tries}${x.predicted === null ? "" : ` \xB7 advisor ${Math.round(100 * x.predicted)}%`}${x.shrouds ? ` \xB7 ${x.shrouds} shrouded` : ""}`),
        ...labyrinthAttempts().slice(-10).map((a) => JSON.stringify(a))
      ]);
    }
    if (ui.upgradeResult) attempt4("Upgrades (last run)", () => textOf(renderUpgrades(), "p, ol.mwia-plan > li").filter((line) => !line.startsWith("Tests one change")).slice(0, 20));
    return { settings: ui.settings, sections };
  }
  var CAPPED_TITLE = "You kill faster than new monsters appear (one encounter per 3 s at most), so more damage barely helps here";
  var cappedBadge = (r) => isSpawnCapped(r) ? ` <span class="mwia-warn" title="${CAPPED_TITLE}">\u23F1</span>` : "";
  function renderZones() {
    let html = `<p>Simulates your current setup against every combat zone and shows where you get the most XP or gold per hour
      <b>${ui.settings.acceptRareDeaths ? "while dying rarely at most" : "without dying"}</b>.</p>
      ${settingsHtml2(["focus", "levels", "gear", "style", "risk", "accuracy", "maxTier"])}${loadoutNote(currentProfile())}
      <button class="mwia-btn" data-action="zones" ${ui.busy ? "disabled" : ""}>Run zone analysis</button>`;
    if (!ui.zoneResults) return html;
    const goal = zoneGoal(ui.zoneResults, ui.settings);
    const best = pickBestZone(ui.zoneResults, ui.settings);
    if (ui.zoneStarter) {
      const w = ui.zoneStarter;
      html += `<p class="mwia-reco">Simulated with <b>${gearLabel(w)}</b> ${w.owned ? "from your inventory" : `(${coins9(w.cost)} on the market)`} instead of your weapon.
          <b>Upgrades</b> shows what else to buy for this style.</p>`;
    }
    const profile = currentProfile();
    const current = profile?.currentZone && ui.zoneResults.find((z) => z.zone.zoneHrid === profile.currentZone.zoneHrid && z.zone.tier === profile.currentZone.tier);
    const summary2 = (r) => `<b>${xpNum(xpValue(r, ui.settings))} ${xpLabel()}</b> and <b>${coins9(perDay(r.profit))}</b> profit/day`;
    if (best) {
      html += `<div class="mwia-reco"><b>Recommendation:</b> ${zoneLabel(best.zone)} \u2013 about ${summary2(best.result)}, ${deathBadge(best.result.deaths)}.`;
      if (isSpawnCapped(best.result)) {
        html += `<br>\u23F1 You kill monsters here as fast as they appear, so this zone is too easy for you.
              ${Number(ui.settings.maxTier) < 5 ? "Raise <b>Max tier</b> and run again \u2013 a harder tier gives more XP per kill." : "Try zones with tougher monsters."}`;
      }
      if (current && current !== best) html += `<br>You're currently fighting in ${zoneLabel(current.zone)}: ${summary2(current.result)}.`;
      html += `</div>`;
    }
    const bestScore = best ? score(best.result, goal) : 1;
    const rows = [...ui.zoneResults].sort((a, b) => score(b.result, goal) - score(a.result, goal));
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>Zone</th><th class="mwia-num" title="How well the zone fits your focus; 100 = the recommended zone">Match</th>
      <th class="mwia-num">${xpLabel()}</th><th class="mwia-num" title="Value of drops (bid price) minus food/drink cost, per day">Profit/day</th>
      <th class="mwia-num">Kills/h</th><th>Risk</th></tr></thead><tbody>`;
    for (const z of rows.slice(0, 40)) {
      const r = z.result;
      const match = bestScore > 0 ? int(100 * score(r, goal) / bestScore) : "\u2013";
      html += `<tr class="${z === best ? "mwia-best" : ""}"><td>${zoneLabel(z.zone)}${cappedBadge(r)}</td><td class="mwia-num">${match}</td><td class="mwia-num">${xpNum(xpValue(r, ui.settings))}</td>
          <td class="mwia-num">${coins9(perDay(r.profit))}</td><td class="mwia-num">${dec3(r.killsTotal, 0)}</td><td>${deathBadge(r.deaths)}</td></tr>`;
    }
    html += `</tbody></table><p class="mwia-dim">Simulated ${int(Math.max(1, runSettings().hours / 2))} h per zone. These are estimates \u2013 differences of a few percent are noise.
      \u23F1 = you kill faster than monsters appear there.</p>`;
    return html;
  }
  function upgradeNotes(c2, base) {
    const notes = [];
    if (c2.owned && c2.cost === 0 && c2.kind === "gear") notes.push('<span class="mwia-ok">you own it</span>');
    if (c2.enhance) notes.push(`<span class="mwia-dim" title="${esc(enhanceDetail(c2))}">\u{1F528} enhance yourself</span>`);
    if (c2.deathsDelta < 0 && base.deaths > 0) notes.push(`<span class="mwia-ok">fewer deaths</span>`);
    if (!c2.safe) notes.push(`<span class="mwia-bad">more deaths</span>`);
    return notes.join(" ");
  }
  function cartItems2(c2) {
    const forOneDay = (hrid) => Math.max(1, Math.ceil(perDay(c2.result?.consumables?.[hrid] || 0)));
    if (c2.kind === "house") return c2.materials.filter((m2) => m2.hrid !== COIN12).map((m2) => ({ hrid: m2.hrid, quantity: m2.count }));
    if (c2.kind === "abilityOrder" || c2.kind === "skillLevel" || c2.kind === "trigger") return [];
    if (c2.enhance) return mergeCart([...enhanceCart(c2), ...c2.extraFood ? [{ hrid: c2.extraFood, quantity: forOneDay(c2.extraFood) }] : []]);
    if (c2.kind === "abilityLevel") return [{ hrid: c2.bookHrid, quantity: c2.books }];
    if (c2.kind === "ability") return c2.cost ? [{ hrid: c2.bookHrid, quantity: 1 }] : [];
    if (c2.kind === "food" || c2.kind === "drinks") return c2.remove ? [] : [{ hrid: c2.hrid, quantity: forOneDay(c2.hrid) }];
    const items = c2.cost ? [{ hrid: c2.hrid, quantity: 1, enhancementLevel: c2.enhancementLevel || 0 }] : [];
    if (c2.extraFood) items.push({ hrid: c2.extraFood, quantity: forOneDay(c2.extraFood) });
    return items;
  }
  var COIN12 = "/items/coin";
  function enhanceCart(c2) {
    const e2 = c2.enhance;
    const items = e2.start === "buy" ? [{ hrid: c2.hrid, quantity: 1, enhancementLevel: 0 }] : [];
    for (const m2 of e2.materials) if (m2.itemHrid !== COIN12) items.push({ hrid: m2.itemHrid, quantity: Math.ceil(m2.count * e2.attempts) });
    if (e2.protect && e2.protections > 0) items.push({ hrid: e2.protect.itemHrid, quantity: Math.ceil(e2.protections), enhancementLevel: 0 });
    for (const tea of e2.teas) items.push({ hrid: tea, quantity: Math.ceil(e2.drinks) });
    return items;
  }
  function mergeCart(items) {
    const merged = /* @__PURE__ */ new Map();
    for (const i of items) {
      const key2 = i.hrid + "#" + (i.enhancementLevel || 0);
      const known = merged.get(key2);
      if (known) known.quantity += i.quantity;
      else merged.set(key2, { ...i });
    }
    return [...merged.values()];
  }
  function hoursText2(h3) {
    if (h3 === null || h3 === void 0 || !Number.isFinite(h3)) return "\u2013";
    if (h3 < 1) return `${Math.max(1, Math.round(h3 * 60))} min`;
    if (h3 < 48) return `${dec3(h3, 1)} h`;
    return `${dec3(h3 / 24, 1)} days`;
  }
  function enhanceDetail(c2) {
    const e2 = c2.enhance;
    const from = e2.start === "worn" ? `your +${e2.from}` : e2.start === "owned" ? `your copy at +${e2.from}` : `a +0 bought for ${coins9(e2.basePrice)}`;
    const parts = [`from ${from} to +${c2.enhancementLevel}: about ${int(e2.attempts)} attempts (${hoursText2(e2.hours)} of Enhancing), materials and teas ${coins9(c2.price - e2.basePrice)}`];
    if (e2.protect) parts.push(`protected from +${e2.protect.from} with ${itemName(e2.protect.itemHrid)} (about ${dec3(e2.protections, 1)})`);
    parts.push(e2.teas.length ? `teas: ${e2.teas.map(itemName).join(", ")}` : "no teas");
    return parts.join("; ");
  }
  function costText2(c2) {
    if (!c2.cost && !c2.resale) return "(free)";
    const sold = c2.resale ? ` (${coins9(c2.price)} \u2212 ${coins9(c2.resale)} selling your ${c2.sold.map((g4) => gearLabel(g4)).join(" and ")})` : "";
    return `for ${c2.cost ? coins9(c2.cost) : "nothing"}${sold}`;
  }
  var starterCart = (w) => w?.cost ? [{ hrid: w.hrid, quantity: 1, enhancementLevel: w.enhancementLevel }] : [];
  var cartLabel = (i) => `${i.quantity ? i.quantity + "\xD7 " : ""}${itemName(i.hrid)}${i.enhancementLevel ? " +" + i.enhancementLevel : ""}`;
  function cartButton4(items, label3 = "\u{1F6D2} Add") {
    if (!items.length) return "";
    const id = String(ui.cartItems.size + 1);
    ui.cartItems.set(id, items);
    return `<button class="mwia-cart-btn" data-action="cart-add" data-cart="${id}" title="Add to the MWITools shopping cart: ${esc(items.map(cartLabel).join(", "))}">${label3}</button>`;
  }
  async function sendToCart(id) {
    const items = ui.cartItems.get(id);
    if (items) await sendItemsToCart(items);
  }
  async function sendItemsToCart(items) {
    try {
      const outcome = await addToCart(ui.win, items);
      const names2 = (list) => list.map(cartLabel).join(", ");
      const parts = [];
      if (outcome.added.length) parts.push(`added ${names2(outcome.added)}`);
      if (outcome.updated.length) parts.push(`topped up ${names2(outcome.updated)}`);
      if (outcome.present.length) parts.push(`${names2(outcome.present)} already in the cart`);
      if (outcome.failed.length) parts.push(`could not add ${names2(outcome.failed)}`);
      ui.notice = { level: outcome.failed.length ? "warn" : "ok", text: "Shopping cart: " + parts.join("; ") + "." };
    } catch (error) {
      ui.notice = { level: "bad", text: error.message };
    }
    render3();
  }
  function renderUpgrades() {
    let html = `<p>Tests one change at a time (gear incl. enhanced +N copies \u2013 bought or enhanced yourself \u2013, new abilities, levelling abilities with extra books,
      the order of your abilities and their triggers, combat house rooms, drinks, food and their triggers, and a few more levels in each skill) in the chosen zone
      and measures how much it improves your focus \u2013 XP per hour, gold per hour, or a mix. Buy the things that give the most per coin first.</p>
      ${settingsHtml2(["focus", "levels", "gear", "style", "zone", "budget", "spending", "risk", "accuracy"])}${loadoutNote(currentProfile())}
      <button class="mwia-btn" data-action="upgrades" ${ui.busy ? "disabled" : ""}>Analyze upgrades</button>
      <button class="mwia-btn" data-action="upgrades-abilities" ${ui.busy ? "disabled" : ""} title="Only abilities, their levels and order, and the triggers of your abilities and food \u2013 much quicker">Abilities &amp; triggers only</button>
      <button class="mwia-link" data-action="trigger-window" title="Open a loadout's \u2699 under an ability in the game first. Reads how the game's Combat Triggers window is built \u2013 changes nothing \u2013 for filling it in later.">\u{1F4CB} Read the game's trigger window</button>`;
    const result = ui.upgradeResult;
    if (!result) return html;
    const base = result.base;
    const label3 = xpLabel();
    html += `<p>Zone: ${zoneLabel(result.zone)}. Now: <b>${xpNum(xpValue(base, ui.settings))} ${label3}</b>, profit <b>${coins9(perDay(base.profit))}/day</b>
      (loot ${coins9(perDay(base.loot))} \u2212 food/drinks ${coins9(perDay(base.cost))}), ${deathBadge(base.deaths)}.</p>`;
    if (isSpawnCapped(base)) {
      html += `<p class="mwia-reco">\u23F1 In ${zoneLabel(result.zone)} you kill monsters as fast as they appear, so upgrades that add damage hardly matter here.
          A harder zone or tier is the biggest improvement \u2013 run <b>Where to fight</b> with a higher Max tier.</p>`;
    }
    const bestNow = ui.settings.zone === "auto" && pickBestZone(ui.zoneResults, ui.settings);
    if (bestNow && (bestNow.zone.zoneHrid !== result.zone.zoneHrid || bestNow.zone.tier !== result.zone.tier)) {
      html += `<p class="mwia-reco">With this focus the best zone is ${zoneLabel(bestNow.zone)}, not ${zoneLabel(result.zone)}. Analyze again to see upgrades for that zone.</p>`;
    }
    const plan = ui.plan;
    const uncertain = uncertainCandidates(ui.upgradeRaw, ui.settings).length;
    if (uncertain) {
      html += `<p>${uncertain} promising suggestion${uncertain === 1 ? " is" : "s are"} not yet beyond doubt.
          <button class="mwia-btn" data-action="refine" ${ui.busy ? "disabled" : ""}>\u{1F3AF} Run more simulations for them</button></p>`;
    }
    html += `<h3>\u{1F4CB} Recommended shopping list</h3>`;
    if (!plan || !hasPlan(plan) && !plan.starter) {
      html += `<p>Nothing within budget gave a reliable improvement that is worth its price. Try Spending "All in", raise the budget, try another zone,
          or just keep levelling \u2013 at some levels that really is the best move.</p>`;
    } else {
      html += `<ol class="mwia-plan">`;
      if (plan.starter) {
        const w = plan.starter;
        html += `<li>${w.owned ? "Equip" : "Buy"} <b>${gearLabel(w)}</b> ${w.owned ? "from your inventory " : ""}to fight as ${STYLE_NAMES[ui.settings.combatStyle] || "the chosen style"}${w.replaces ? ` \u2013 replaces ${gearLabel(w.replaces)}` : ""}
              ${w.cost ? `for ${coins9(w.cost)}` : "(free)"} <span class="mwia-dim">(everything here was simulated with it)</span> ${cartButton4(starterCart(w))}</li>`;
      }
      for (const p2 of plan.picks) {
        let what;
        if (p2.kind === "abilityLevel") {
          what = `${p2.books}\xD7 <b>${esc(itemName(p2.bookHrid))}</b> and read them: ${esc(abilityName(p2.hrid))} level ${p2.fromLevel} \u2192 ${p2.level}`;
        } else if (p2.kind === "ability") {
          what = `ability <b>${esc(abilityName(p2.hrid))}</b>${p2.cost ? ` (buy the book ${esc(itemName(p2.bookHrid))})` : ` (level ${p2.level})`}${p2.triggers ? `, triggers: <b>${esc(describeTriggers(p2.triggers, getClientData()))}</b>` : ""}`;
        } else if (p2.kind === "house") {
          html += `<li>Build <b>${esc(p2.name)}</b> level ${p2.fromLevel} \u2192 ${p2.level} <span class="mwia-dim">(${houseMaterials(p2)})</span>: ${gainText2(p2)} for ${coins9(p2.cost)} ${cartButton4(cartItems2(p2), "\u{1F6D2} Materials")}</li>`;
          continue;
        } else if (p2.enhance) {
          const own = p2.enhance.start === "worn" ? `your <b>${gearLabel(p2.replaces)}</b>` : p2.enhance.start === "owned" ? `your <b>${gearLabel({ hrid: p2.hrid, enhancementLevel: p2.enhance.from })}</b>` : `a <b>${gearLabel({ hrid: p2.hrid })}</b>`;
          const replaces2 = p2.enhance.start !== "worn" && p2.replaces ? ` \u2013 replaces ${gearLabel(p2.replaces)}` : "";
          html += `<li>${p2.enhance.start === "buy" ? "Buy" : "Take"} ${own} and enhance it to <span class="mwia-enh">+${p2.enhancementLevel}</span> yourself
                  <span class="mwia-dim">(${esc(enhanceDetail(p2))})</span>${replaces2}: ${gainText2(p2)} ${costText2(p2)} ${cartButton4(cartItems2(p2))}</li>`;
          continue;
        } else {
          what = `<b>${gearLabel(p2)}</b> in ${SLOT_NAMES[p2.slot]}${p2.extraFood ? ` and put <b>${esc(itemName(p2.extraFood))}</b> in the new food slot` : ""}`;
        }
        const replaces = p2.replaces ? ` \u2013 replaces ${p2.kind === "ability" ? esc(abilityName(p2.replaces)) : gearLabel(p2.replaces)}` : "";
        html += `<li>${p2.cost || p2.price ? "Buy" : "Use"} ${what}${replaces}: ${gainText2(p2)} ${costText2(p2)} ${cartButton4(cartItems2(p2))}</li>`;
      }
      if (plan.order) {
        html += `<li>Put your abilities in this order: <b>${plan.order.order.map((h3) => esc(abilityName(h3))).join(" \u2192 ")}</b>
              <span class="mwia-dim">(now ${plan.order.was.map((h3) => esc(abilityName(h3))).join(" \u2192 ")})</span>: ${gainText2(plan.order)} (free)</li>`;
      }
      for (const t4 of plan.triggers || []) {
        html += `<li>Set the triggers of <b>${esc(triggerTargetName(t4))}</b> to <b>${esc(describeTriggers(t4.triggers, getClientData()))}</b>
              <span class="mwia-dim">(now ${esc(describeTriggers(t4.was, getClientData()))})</span>: ${gainText2(t4)} (free)</li>`;
      }
      for (const [kind, pick2, max] of [["Food", plan.food, plan.foodMax], ["Drink", plan.drink, plan.drinkMax]]) {
        if (!pick2) continue;
        if (pick2.remove) {
          html += `<li>Stop using <b>${esc(itemName(pick2.hrid))}</b> (empty that ${kind.toLowerCase()} slot): ${gainText2(pick2)},
                  saves about ${coins9(perDay(-pick2.costPerHourDelta))}/day`;
        } else {
          const where = pick2.replaces ? `instead of ${esc(itemName(pick2.replaces))}` : "in an empty slot";
          const money = pick2.costPerHourDelta < 0 ? `saves about ${coins9(perDay(-pick2.costPerHourDelta))}/day` : `costs about ${coins9(perDay(pick2.costPerHourDelta))}/day extra`;
          html += `<li>${kind} <b>${esc(itemName(pick2.hrid))}</b> ${where}: ${gainText2(pick2)}, ${money}
                  <span class="mwia-dim">(optional \u2013 a running cost)</span> ${cartButton4(cartItems2(pick2), "\u{1F6D2} 1 day")}`;
        }
        if (dropsHpFood(pick2)) {
          html += `<br><span class="mwia-warn">You don't need HP food in this zone, but keep some at hand \u2013 put it back before you move to a harder zone or tier.</span>`;
        }
        if (max) html += `<br><span class="mwia-dim">Biggest gain: ${esc(itemName(max.hrid))} (${gainText2(max)}) at ${coins9(perDay(max.costPerHourDelta))}/day.</span>`;
        html += `</li>`;
      }
      html += `</ol><p>Total one-time cost: <b>${coins9(plan.spent)}</b> of your ${coins9(Number(ui.settings.budget) || 0)} budget.
          ${cartButton4([...starterCart(plan.starter), ...plan.picks.flatMap(cartItems2)], "\u{1F6D2} Add all purchases to cart")}</p>`;
      if (ui.verified) {
        const v = ui.verified;
        const before = xpValue(v.base, ui.settings);
        const after = xpValue(v.planned, ui.settings);
        html += `<div class="mwia-reco">Everything combined (simulated): <b>${xpNum(before)} \u2192 ${xpNum(after)} ${label3}</b> (${pct5(after / Math.max(countingLevels() ? 1e-9 : 1, before) - 1)}),
              profit <b>${coins9(perDay(v.base.profit))} \u2192 ${coins9(perDay(v.planned.profit))}</b> per day (food/drinks ${coins9(perDay(v.base.cost))} \u2192 ${coins9(perDay(v.planned.cost))}),
              deaths ${dec3(v.base.deaths, 2)} \u2192 ${dec3(v.planned.deaths, 2)} per hour.
              <br><span class="mwia-dim">Run the zone analysis again after buying \u2013 with better gear a harder zone may become the best.</span></div>`;
      }
    }
    const all = result.scope !== "abilities";
    if (all) html += upgradeTable("Equipment", result.gear, base, (c2) => SLOT_NAMES[c2.slot], (c2) => gearLabel(c2) + (c2.extraFood ? ` <span class="mwia-dim">+ ${esc(itemName(c2.extraFood))} in new slot</span>` : ""), (c2) => c2.replaces ? gearLabel(c2.replaces) : "\u2013", "Item");
    html += upgradeTable(
      "Abilities",
      result.abilities,
      base,
      (c2) => `Slot ${c2.slot.replace("ability", "")}`,
      (c2) => esc(abilityName(c2.hrid)) + (c2.kind === "abilityLevel" ? ` <span class="mwia-dim">lvl ${c2.fromLevel} \u2192 ${c2.level} (${c2.books} books)</span>` : ` <span class="mwia-dim">lvl ${c2.level}</span>`) + (c2.triggers ? `<br><span class="mwia-dim">triggers: ${esc(describeTriggers(c2.triggers, getClientData()))}</span>` : ""),
      (c2) => c2.kind === "abilityLevel" ? '<span class="mwia-dim">level up</span>' : c2.replaces ? esc(abilityName(c2.replaces)) : "\u2013",
      "Ability"
    );
    if (!getClientData().levelExperienceTable) {
      html += `<p class="mwia-dim">The game data has no level table, so levelling up abilities with extra books could not be evaluated.</p>`;
    }
    html += orderTable(result.orders || []);
    html += triggerTable(result.triggers || [], result);
    if (all) {
      html += upgradeTable("House", result.house || [], base, () => "House", (c2) => `${esc(c2.name)} <span class="mwia-dim">lvl ${c2.fromLevel} \u2192 ${c2.level}</span>`, () => "\u2013", "Room");
      html += levelTable(result.levels || [], base);
      html += consumableTable("Drinks", result.drinks, base);
      html += consumableTable("Food", result.food, base);
    } else {
      html += `<p class="mwia-dim">Only abilities and triggers were tested. <b>Analyze upgrades</b> also tests gear, house rooms, drinks and food.</p>`;
    }
    if (result.food.some((c2) => !c2.safe && c2.delta > 0) && result.gear.some((c2) => c2.extraFood && c2.safe && c2.delta > 0)) {
      html += `<p class="mwia-reco">Some food gives more XP but makes you die, because it replaces your only HP food. A bigger pouch gives an extra
          food slot so you can keep both \u2013 see the pouch row under Equipment.</p>`;
    }
    html += `<p class="mwia-dim">Prices = lowest sell order on the market right now, also for enhanced (+N) gear \u2013 or, when it is cheaper, enhancing it yourself (\u{1F528}:
      your Enhancing level, tool and Observatory, the cheapest teas and protection; from the copy you wear or own, or a +0 bought for it). Gear you take off is
      counted as sold at the best bid after the 4% tax, so the price is what the change really costs (* in the Price column); that is what the budget counts.
      House rooms cost their coins and materials at the lowest sell order. "Gain" = improvement of your focus as a share of
      what you have now (XP/h and/or profit/h, weighted by the slider); "Gain per 1M" = gain per million coins spent. Profit counts loot minus food/drink cost,
      so with a gold focus expensive drinks drop out by themselves.
      Items you already own cost 0. "Sure" = how certain it is that a suggestion is a real improvement and not luck; faded rows are below ${Math.round(CONFIDENCE_LEVEL * 100)}%
      and never go on the shopping list. Changes that make you die more often than you accept
      (\u2716) are never put on the shopping list.</p>`;
    return html;
  }
  function dropsHpFood(c2) {
    if (c2.kind !== "food") return false;
    const items = getClientData().itemDetailMap;
    const heals = (hrid) => (items[hrid]?.consumableDetail?.hitpointRestore || 0) > 0;
    const before = currentProfile()?.food || [];
    const after = c2.profile?.food || [];
    return before.some((h3) => h3 && heals(h3)) && !after.some((h3) => h3 && heals(h3));
  }
  function gainText2(c2) {
    const gold = ui.upgradeResult.goal.gold;
    const profit = `${signed3(coins9, perDay(c2.profitDelta))} profit/day`;
    if (gold === 0) return `${pct5(c2.deltaPct)} ${xpLabel()}`;
    if (gold === 1) return profit;
    return `${pct5(c2.deltaPct)} gain (${signed3(xpNum, c2.xpDelta)} ${xpLabel()}, ${profit})`;
  }
  function confidenceCell(c2) {
    const value = Math.round(c2.confidence * 100);
    const cls = c2.confidence >= CONFIDENCE_LEVEL ? "mwia-ok" : c2.confidence >= 0.7 ? "mwia-warn" : "mwia-dim";
    const title = c2.screened ? "Ruled out after one simulation: all but sure to give less than 1%, whatever the focus, so it got no more runs" : `Chance that this really improves your focus, from ${c2.runs.length} simulations`;
    return `<span class="${cls}" title="${title}">${value}%${c2.screened ? " \u2717" : ""}</span>`;
  }
  var CONF_TITLE = "How sure we are that this is an improvement and not luck (paired t-test over several simulations with different random seeds). Only \u2265 90% goes on the shopping list.";
  var GAIN_TITLE = "Improvement of your focus as a share of what you have now: XP/h and profit/h, weighted by the XP\u2013Gold slider";
  function upgradeTable(title, list, base, slotText, nameHtml, replacesHtml, nameHeader) {
    const shown = list.filter((c2) => c2.delta > 0).slice(0, 20);
    let html = `<h3>${title}</h3>`;
    if (!shown.length) return html + `<p class="mwia-dim">Nothing within budget improved your focus.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>Slot</th><th>${nameHeader}</th><th>Replaces</th><th class="mwia-num">Price</th>
      <th class="mwia-num">+${xpLabel()}</th><th class="mwia-num">+Profit/day</th><th class="mwia-num" title="${GAIN_TITLE}">Gain</th>
      <th class="mwia-num">Gain per 1M</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th></th><th></th></tr></thead><tbody>`;
    for (const c2 of shown) {
      const efficiency = c2.cost > 0 ? pct5(c2.delta / c2.cost * 1e6) : "\u221E";
      html += `<tr class="${c2.significant ? "" : "mwia-faded"}"><td>${slotText(c2)}</td><td>${nameHtml(c2)}</td><td>${replacesHtml(c2)}</td>
          <td class="mwia-num"${c2.resale ? ` title="${coins9(c2.price)} \u2212 ${coins9(c2.resale)} for what it replaces"` : ""}>${c2.cost ? coins9(c2.cost) : "0"}${c2.resale ? '<span class="mwia-dim">*</span>' : ""}</td><td class="mwia-num">${signed3(xpNum, c2.xpDelta)}</td><td class="mwia-num">${signed3(coins9, perDay(c2.profitDelta))}</td>
          <td class="mwia-num">${pct5(c2.deltaPct)}</td><td class="mwia-num">${efficiency}</td><td class="mwia-num">${confidenceCell(c2)}</td>
          <td>${upgradeNotes(c2, base)}</td><td>${cartButton4(cartItems2(c2))}</td></tr>`;
    }
    return html + `</tbody></table>`;
  }
  function houseMaterials(c2) {
    return c2.materials.map((m2) => m2.hrid === COIN12 ? `${coins9(m2.count)} coins` : `${int(m2.count)}\xD7 ${esc(itemName(m2.hrid))}`).join(", ");
  }
  function orderTable(list) {
    const shown = list.filter((c2) => c2.delta > 0).slice(0, 5);
    let html = `<h3>Ability order</h3>`;
    if (!list.length) return html + `<p class="mwia-dim">Fewer than two abilities in your slots \u2013 nothing to reorder.</p>`;
    if (!shown.length) return html + `<p class="mwia-dim">Your order is the best of the ${list.length + 1} orders tried.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>Order</th><th class="mwia-num">+${xpLabel()}</th><th class="mwia-num">+Profit/day</th>
      <th class="mwia-num" title="${GAIN_TITLE}">Gain</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th></th></tr></thead><tbody>`;
    for (const c2 of shown) {
      html += `<tr class="${c2.significant ? "" : "mwia-faded"}"><td>${c2.order.map((h3) => esc(abilityName(h3))).join(" \u2192 ")}</td>
          <td class="mwia-num">${signed3(xpNum, c2.xpDelta)}</td><td class="mwia-num">${signed3(coins9, perDay(c2.profitDelta))}</td><td class="mwia-num">${pct5(c2.deltaPct)}</td>
          <td class="mwia-num">${confidenceCell(c2)}</td><td>${upgradeNotes(c2, ui.upgradeResult.base)}</td></tr>`;
    }
    return html + `</tbody></table>`;
  }
  var triggerTargetName = (c2) => c2.target === "food" ? itemName(c2.hrid) : abilityName(c2.hrid);
  function triggerTable(list, result) {
    const data = getClientData();
    const shown = list.filter((c2) => c2.delta > 0).slice(0, 8);
    let html = `<h3>Triggers</h3>`;
    const waiting = Object.entries(result.telemetry?.abilities || {}).filter(([, s2]) => s2.waitingPerHour >= 0.1 * Math.max(1, s2.castsPerHour) && s2.waitingPerHour >= 3);
    if (waiting.length) {
      html += `<p class="mwia-dim">Waiting for mana (an auto attack instead, as its triggers held): ${waiting.map(([hrid, s2]) => `${esc(abilityName(hrid))} ${int(s2.waitingPerHour)}\xD7/h (cast ${int(s2.castsPerHour)}\xD7/h)`).join(", ")}.</p>`;
    }
    if (!list.length) return html + `<p class="mwia-dim">Nothing in the simulation pointed to a trigger worth changing.</p>`;
    if (!shown.length) return html + `<p class="mwia-dim">Your triggers are the best of the ${(result.triggerVariants || list).length + 1} settings tried.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>For</th><th>Triggers</th><th>Now</th><th class="mwia-num">+${xpLabel()}</th><th class="mwia-num">+Profit/day</th>
      <th class="mwia-num" title="${GAIN_TITLE}">Gain</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th></th></tr></thead><tbody>`;
    for (const c2 of shown) {
      html += `<tr class="${c2.significant ? "" : "mwia-faded"}"><td>${esc(triggerTargetName(c2))}</td><td>${esc(describeTriggers(c2.triggers, data))}</td>
          <td class="mwia-dim">${esc(describeTriggers(c2.was, data))}</td>
          <td class="mwia-num">${signed3(xpNum, c2.xpDelta)}</td><td class="mwia-num">${signed3(coins9, perDay(c2.profitDelta))}</td><td class="mwia-num">${pct5(c2.deltaPct)}</td>
          <td class="mwia-num">${confidenceCell(c2)}</td><td>${upgradeNotes(c2, ui.upgradeResult.base)}</td></tr>`;
    }
    return html + `</tbody></table>`;
  }
  function levelTable(list, base) {
    if (!list.length) return "";
    let html = `<h3>More levels (not for sale)</h3><p class="mwia-dim">What a few more levels in a skill would give, to weigh against what you can buy.
      The time is at the XP an hour that skill gets now, in this zone.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>Skill</th><th>Levels</th><th class="mwia-num">+${xpLabel()}</th><th class="mwia-num">+Profit/day</th>
      <th class="mwia-num" title="${GAIN_TITLE}">Gain</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th class="mwia-num" title="Time to get there at the XP an hour the skill gets now">Time</th><th></th></tr></thead><tbody>`;
    for (const c2 of list) {
      html += `<tr class="${c2.significant ? "" : "mwia-faded"}"><td>${SKILL_NAMES[c2.hrid] || esc(c2.hrid)}</td><td>${c2.fromLevel} \u2192 ${c2.level}</td>
          <td class="mwia-num">${signed3(xpNum, c2.xpDelta)}</td><td class="mwia-num">${signed3(coins9, perDay(c2.profitDelta))}</td><td class="mwia-num">${pct5(c2.deltaPct)}</td>
          <td class="mwia-num">${confidenceCell(c2)}</td><td class="mwia-num">${hoursText2(c2.hoursToReach)}</td><td>${upgradeNotes(c2, base)}</td></tr>`;
    }
    return html + `</tbody></table>`;
  }
  function consumableTable(title, list, base) {
    const shown = list.filter((c2) => c2.delta > 0 || c2.deathsDelta < 0).slice(0, 10);
    let html = `<h3>${title}</h3>`;
    if (!shown.length) return html + `<p class="mwia-dim">No ${title.toLowerCase()} noticeably improved your focus.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>${title === "Food" ? "Food" : "Drink"}</th><th>Replaces</th><th class="mwia-num">Unit price</th>
      <th class="mwia-num">Extra cost/day</th><th class="mwia-num">+${xpLabel()}</th><th class="mwia-num" title="Includes the extra food/drink cost">+Profit/day</th>
      <th class="mwia-num" title="${GAIN_TITLE}">Gain</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th class="mwia-num">Deaths/h</th><th class="mwia-num" title="${countingLevels() ? "Extra cost per extra level" : "Extra cost per 1000 extra XP"}">${countingLevels() ? "Cost per level" : "Cost per 1000 XP"}</th><th></th></tr></thead><tbody>`;
    for (const c2 of shown) {
      const unit = countingLevels() ? 1 : 1e3;
      const per1000 = c2.xpDelta > 0 ? coins9(c2.costPerHourDelta / c2.xpDelta * unit) : c2.remove && c2.xpDelta < 0 ? `saves ${coins9(c2.costPerHourDelta / c2.xpDelta * unit)}` : "\u2013";
      const name = (c2.remove ? `<i>Stop using</i> ${esc(itemName(c2.hrid))}` : esc(itemName(c2.hrid))) + (dropsHpFood(c2) ? ' <span class="mwia-warn" title="Leaves you without HP food \u2013 fine in this zone, risky in harder ones">\u26A0 no HP food</span>' : "");
      html += `<tr class="${c2.significant ? "" : "mwia-faded"}"><td>${name}</td><td>${c2.replaces ? esc(itemName(c2.replaces)) : "\u2013"}</td>
          <td class="mwia-num">${c2.remove ? "\u2013" : coins9(askPrice(c2.hrid))}</td><td class="mwia-num">${coins9(perDay(c2.costPerHourDelta))}</td><td class="mwia-num">${signed3(xpNum, c2.xpDelta)}</td>
          <td class="mwia-num">${signed3(coins9, perDay(c2.profitDelta))}</td><td class="mwia-num">${pct5(c2.deltaPct)}</td><td class="mwia-num">${confidenceCell(c2)}</td>
          <td class="mwia-num ${c2.safe ? "" : "mwia-bad"}">${dec3(c2.result.deaths, 2)}${c2.safe ? "" : " \u2716"}</td><td class="mwia-num">${per1000}</td>
          <td>${cartButton4(cartItems2(c2), "\u{1F6D2} 1 day")}</td></tr>`;
    }
    return html + `</tbody></table>`;
  }
  function renderGuide() {
    return `<div class="mwia-guide">
    <h3>How combat XP works</h3>
    <p>Every kill gives XP. <b>30%</b> goes to your weapon's skill (Magic for a staff, Ranged for a bow, Melee for a sword or mace, Attack for a spear)
    and the remaining <b>70%</b> is split evenly between Stamina, Intelligence, Attack, Defense and your style's skill (Magic, Ranged or Melee). With a
    <b>charm</b> that has a focus (e.g. Trainee Stamina Charm) the whole 70% share goes to that skill instead. More damage and fewer deaths mean more kills
    per hour, and therefore more XP.</p>
    <h3>Total level</h3>
    <p>Each level needs more XP than the one before, so the same XP buys far more levels in a low skill. A style you never trained (Ranged or Melee at 1)
    gives its first 20 levels for very little; so does a focus charm on your lowest combat skill. Tick <b>Count levels, not XP</b> to rank zones,
    upgrades and skilling actions by the levels they give.</p>
    <h3>What the skills do</h3>
    <ul>
      <li><b>Magic / Ranged / Melee</b> \u2013 raises your max damage with that style (both auto-attacks and abilities of that style).</li>
      <li><b>Attack</b> \u2013 accuracy. Misses deal no damage at all.</li>
      <li><b>Intelligence</b> \u2013 max mana (10 \xD7 (10 + level)) and more ability slots (at levels 20, 50 and 90).</li>
      <li><b>Stamina</b> \u2013 max HP (10 \xD7 (10 + level)).</li>
      <li><b>Defense</b> \u2013 evasion against enemy attacks.</li>
    </ul>
    <h3>Abilities</h3>
    <p>Abilities add a lot of damage \u2013 for a mage most of it, since staves halve auto-attack damage. They cost mana, are learned by reading an
    ability book (bought on the market) and get stronger as they level up, which happens when you use them or read more copies of the same book.
    Order matters: each turn the topmost ability whose triggers hold goes first \u2013 and if its mana isn't there yet, you auto-attack
    instead of casting the next one. Abilities without a cooldown (Water Strike, Fireball, Entangle) are moved behind the others in battle.
    A trigger like "own MP \u2265 its cost" lets the next ability go while one waits for mana; Upgrades tries such changes (Triggers).</p>
    <h3>Food and drinks</h3>
    <p><b>Food</b> is eaten automatically according to its triggers (by default when you're missing enough HP/MP). HP food keeps you alive,
    MP food lets you keep casting abilities. <b>Drinks</b> (coffee) give a 5-minute buff, e.g. Magic or Ranged Coffee (+level)
    or Wisdom Coffee (+XP). A <b>pouch</b> gives extra food and drink slots.</p>
    <h3>The Labyrinth</h3>
    <p>A combat room is one monster, scaled to the room level, fought 1 against 1 from full HP and mana with no food or drinks (only the crates
    opened on entry) and 2 minutes to win, so single-target damage is what counts. Every monster hardly dodges one or two attack styles and dodges
    the rest many times over, and takes far more of one damage type: the Labyrinth wants magic for some rooms, ranged for others and melee for the
    rest. The game's Labyrinth automation can put on a loadout for each room type, so a loadout per combat style pays off. The <b>Labyrinth</b>
    tab shows which of your loadouts to use for each room type, which rooms to shroud or go around, what would take you further, and builds a
    loadout for the rooms of one style.</p>
    <h3>What this script does</h3>
    <p>It reads your character from the game, fetches current market prices and runs combat simulations with the same engine as the community
    Combat Simulator (shykai/AmVoidGuy, MIT licence), but fed with the game's own current data. Every suggestion is tested by simulating
    several hours of combat with and without the change. These are estimates \u2013 reality can differ by a few percent.</p>
    <p class="mwia-dim">The script only reads data and shows suggestions. It never buys, equips or clicks anything for you.</p>
    </div>`;
  }
  function renderSkillingTab() {
    if (!state.character) {
      return `<p>The script hasn't seen your character yet. It reads it when the game connects, so <b>reload the page (F5)</b> with the script enabled.</p>`;
    }
    if (getClientData() && pricesAge() !== null) return renderSkilling(ui.settings);
    const load3 = ui.skillingLoad;
    if (load3?.error) {
      return `<div class="mwia-error">${esc(load3.error)}</div><button class="mwia-btn" data-action="skilling-load">Try again</button>`;
    }
    if (!load3?.loading) {
      ui.skillingLoad = { loading: true };
      Promise.all([loadClientData(ui.win), loadPrices()]).then(() => ui.skillingLoad = null).catch((error) => ui.skillingLoad = { error: error.message || String(error) }).finally(() => ui.tab === "skilling" && render3());
    }
    return `<p class="mwia-dim">Loading game data and market prices\u2026</p>`;
  }
  function returnAfterMarket() {
    clearInterval(ui.marketWatch);
    const started = Date.now();
    let seen = false;
    ui.marketWatch = setInterval(() => {
      if (!ui.root.classList.contains("mwia-hidden")) return clearInterval(ui.marketWatch);
      const open2 = [...document.querySelectorAll(MARKET_PANEL)].some(visible);
      if (open2) seen = true;
      else if (seen) {
        clearInterval(ui.marketWatch);
        showPanel();
      } else if (Date.now() - started > MARKET_SHOW_MS) clearInterval(ui.marketWatch);
    }, MARKET_POLL_MS);
  }
  function showPanel() {
    ui.root.classList.remove("mwia-hidden");
    render3();
    const row = ui.returnRow && ui.tab === "skilling" ? [...ui.root.querySelectorAll(".mwia-skill-row")].find((r) => r.dataset.hrid === ui.returnRow) : null;
    row?.scrollIntoView({ block: "start" });
    ui.returnRow = null;
  }
  async function openWithCount(actionHrid, count3) {
    const data = getClientData();
    const action = data?.actionDetailMap[actionHrid];
    if (!action || !count3) return;
    clearNotice();
    ui.root.classList.add("mwia-hidden");
    if (await openAction(ui.win, action, data)) {
      const found = findActionPanel(action.name);
      if (found?.input) setReactInput(found.input, count3);
      return;
    }
    ui.root.classList.remove("mwia-hidden");
    showNotice({ level: "warn", text: `Could not open ${action.name} automatically. Open it yourself and enter ${count3}.`, diag: navDiagnostics() });
  }
  async function openLeveling(dataset) {
    const { item, kind, label: label3 } = dataset;
    const level = Number(dataset.level) || 0;
    const stacks = [...state.items.values()].filter((i) => i.itemHrid === item && i.itemLocationHrid === "/item_locations/inventory");
    const held = stacks.filter((i) => (i.enhancementLevel || 0) === level).reduce((sum, i) => sum + (i.count || 0), 0);
    const all = Number(dataset.all) || 0;
    const value = all && Math.floor(held / all) || Number(dataset.value) || 0;
    const steps = [`${kind} ${item}${level ? ` +${level}` : ""} ${kind === "enhance" ? `\u2192 +${value}` : `${label3} \xD7${value}`}`];
    steps.push(stacks.length ? `inventory: ${stacks.map((i) => `${i.count} at +${i.enhancementLevel || 0}`).join(", ")}` : "not in the inventory");
    const owned = held > 0;
    const characterId4 = state.character?.character?.id;
    if (owned && !characterId4) steps.push("no character id");
    const hash2 = owned && characterId4 ? inventoryItemHash(characterId4, item, level) : null;
    const ownHash = (hrid) => hrid && characterId4 && [...state.items.values()].some((i) => i.itemHrid === hrid && i.itemLocationHrid === "/item_locations/inventory" && !i.enhancementLevel && i.count > 0) ? inventoryItemHash(characterId4, hrid) : null;
    const protect = dataset.protect ? { hash: ownHash(dataset.protect), from: Number(dataset.protectFrom) } : null;
    const catalyst = dataset.catalyst ? { hash: ownHash(dataset.catalyst) } : null;
    clearNotice();
    ui.root.classList.add("mwia-hidden");
    const opened = kind === "enhance" ? await openEnhancing(hash2, value, protect) : await openAlchemy(hash2, label3, value, catalyst);
    if (opened === "item") return;
    if (opened === "partial") {
      const extra = kind === "enhance" ? `${dataset.protect ? `put ${itemName(dataset.protect)} in as protection from +${dataset.protectFrom}` : ""}` : `put ${itemName(dataset.catalyst)} in as the catalyst`;
      ui.notice = { level: "info", text: `Opened with the item, but couldn't ${extra} \u2013 do that in the game.`, diag: [...steps, navDiagnostics()].filter(Boolean).join(" \xB7 ") };
      ui.showNotice = true;
      return;
    }
    steps.push(navDiagnostics());
    ui.root.classList.remove("mwia-hidden");
    const what = kind === "enhance" ? `set the target to +${value}` : `pick ${label3}${value ? ` and enter ${value}` : ""}`;
    const diag = steps.filter(Boolean).join(" \xB7 ");
    showNotice(opened === "page" ? { level: "info", text: `${owned ? "Opened the page but could not put the item in." : "You don't have the item yet \u2013 buy it first (\u{1F6D2})."} Pick it in the game and ${what}.`, diag } : { level: "warn", text: `Could not open it automatically. Open it yourself and ${what}.`, diag });
  }
  var VERSION3 = true ? "0.77.0" : "dev";
  function clearNotice() {
    ui.notice = null;
    ui.root.querySelector(".mwia-notice")?.remove();
  }
  function showNotice(notice) {
    ui.notice = notice;
    ui.showNotice = true;
    render3();
  }
  function buttonFailed(what, error) {
    ui.root?.classList.remove("mwia-hidden");
    const where = String(error?.stack || "").split("\n").slice(0, 4).join(" | ");
    showNotice({ level: "bad", text: `${what} failed: ${error?.message || error}`, diag: where });
  }
  function noticeHtml(notice) {
    const diag = notice.diag ? `<div class="mwia-notice-diag">${esc(notice.diag)}</div><button class="mwia-link mwia-notice-copy" data-action="copy-notice">\u{1F4CB} Copy</button>` : "";
    return `<div class="mwia-notice mwia-notice-${notice.level}">${esc(notice.text)}${diag}</div>`;
  }
  var noticeCopyText = (notice, agent = navigator.userAgent) => [notice.text, notice.diag, `MWI Advisor v${VERSION3} \xB7 ${agent}`].filter(Boolean).join("\n");
  async function copyNotice(button2) {
    if (!ui.notice) return;
    const text = noticeCopyText(ui.notice);
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(box);
      box.select();
      box.setSelectionRange(0, text.length);
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      box.remove();
    }
    button2.textContent = copied ? "\u2713 Copied" : "Select the text above to copy it";
  }
  function onClick9(event) {
    const target = event.target.closest("[data-action],[data-tab]");
    if (!target || !ui.root.contains(target)) return;
    try {
      const running2 = act(target);
      running2?.catch?.((error) => buttonFailed(clean5(target.textContent) || target.dataset.action, error));
    } catch (error) {
      buttonFailed(clean5(target.textContent) || target.dataset.action, error);
    }
  }
  var clean5 = (text) => String(text || "").replace(/\s+/g, " ").trim();
  function act(target) {
    if (target.dataset.tab) {
      if (ui.tab !== target.dataset.tab) ui.notice = null;
      ui.tab = target.dataset.tab;
      render3();
      return;
    }
    switch (target.dataset.action) {
      case "close":
        ui.root.classList.add("mwia-hidden");
        break;
      case "horizon-run":
        return sendSnapshot({ run: true }).then(() => ui.tab === "horizon" && render3());
      case "zones":
        runTask(doZones);
        break;
      case "upgrades":
        runTask(() => doUpgrades("all"));
        break;
      case "laby-check":
        runTask(doLabyrinth);
        break;
      case "laby-improve":
        runTask(doLabImprove);
        break;
      case "laby-build":
        runTask(doLabBuild);
        break;
      case "laby-read":
        ui.notice = { level: "info", text: "The game's Labyrinth, read (nothing changed). Copy it and paste it into the chat.", diag: labyrinthReport() };
        ui.showNotice = true;
        render3();
        break;
      case "upgrades-abilities":
        runTask(() => doUpgrades("abilities"));
        break;
      case "trigger-window": {
        const diag = triggerWindowReport();
        const open2 = !diag.includes("trigger window: not open");
        ui.notice = {
          level: open2 ? "info" : "warn",
          text: open2 ? "The game's trigger window, read (nothing changed). Copy it and paste it into the chat." : "No Combat Triggers window is open. In the game: Loadouts \u2192 your combat loadout \u2192 \u2699 under an ability, then tap this again.",
          diag
        };
        render3();
        break;
      }
      case "refine":
        runTask(doRefine);
        break;
      case "load":
        runTask(async () => {
        });
        break;
      case "skilling-load":
        ui.skillingLoad = null;
        render3();
        break;
      case "skilling-make":
        ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
        return openWithCount(target.dataset.hrid, Number(target.dataset.count));
      case "skilling-level":
        ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
        return openLeveling(target.dataset);
      case "enhance-loop":
        ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
        clearNotice();
        ui.root.classList.add("mwia-hidden");
        return startLoop(JSON.parse(target.dataset.loop));
      case "copy-notice":
        return copyNotice(target);
      case "skilling-train": {
        const plan = JSON.parse(target.dataset.plan);
        ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
        ui.root.classList.add("mwia-hidden");
        startTrain({ goals: [{ kind: "item", hrid: plan.product, target: plan.target }], policies: new Map(plan.made.map((hrid) => [hrid, "chain"])), title: plan.title });
        break;
      }
      case "skilling-cart":
        if (target.dataset.job) preferBuyLimits(target.dataset.job);
        sendItemsToCart(JSON.parse(target.dataset.teas || "[]"));
        break;
      case "skilling-market":
        ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
        if (openMarketplace(ui.win, target.dataset.item, Number(target.dataset.level) || 0)) {
          ui.root.classList.add("mwia-hidden");
          returnAfterMarket();
        } else {
          ui.notice = { level: "warn", text: "Could not open the marketplace automatically. Open it yourself and pick the item." };
          render3();
        }
        break;
      case "export":
        exportClicked(target);
        break;
      case "skilling-all":
        toggleShowAll();
        render3();
        break;
      case "cart-add":
        sendToCart(target.dataset.cart);
        break;
      case "market-open":
        if (openMarketplace(ui.win, target.dataset.item, Number(target.dataset.level) || 0)) {
          ui.root.classList.add("mwia-hidden");
          returnAfterMarket();
        } else {
          ui.notice = { level: "warn", text: "Could not open the marketplace automatically. Open it yourself and pick the item." };
          render3();
        }
        break;
      case "market-keep":
        toggleKeep(target.dataset.item, target.dataset.level);
        render3();
        break;
      case "market-all":
        toggleShowAllMarket();
        render3();
        break;
      case "cancel":
        ui.pool?.cancel();
        break;
    }
  }
  function onChange(event) {
    const key2 = event.target.dataset?.setting;
    if (!key2) return;
    if (key2 === "budget") {
      const value = parseCoins(event.target.value);
      event.target.classList.toggle("mwia-invalid", value === null);
      if (value === null) return;
      ui.settings.budget = value;
      event.target.value = coinsInput(value);
    } else if (key2 === "acceptRareDeaths" || key2 === "countLevels") {
      ui.settings[key2] = event.target.checked;
    } else if (key2 === "goldWeight") {
      ui.settings.goldWeight = Number(event.target.value) / 100;
    } else {
      ui.settings[key2] = event.target.value;
    }
    saveSettings();
    if (key2.startsWith("skilling") || key2.startsWith("horizon")) {
      render3();
      return;
    }
    if (key2.startsWith("laby")) {
      if (key2 === "labyFloor") {
        if (event.target.value) ui.settings.labyLevel = floorLevel(Number(event.target.value));
        delete ui.settings.labyFloor;
        saveSettings();
      } else if (key2 === "labyCoffee" || key2 === "labyFood") {
        ui.labResult = ui.labImprove = ui.labBuild = null;
      }
      scheduleScan8();
      render3();
      return;
    }
    if (key2 === "combatStyle" || key2 === "combatGear") {
      ui.zoneResults = null;
      if (key2 === "combatGear") ui.labBuild = null;
      ui.upgradeRaw = ui.upgradeResult = ui.plan = ui.verified = null;
      render3();
      return;
    }
    if (["budget", "spending", "goldWeight", "acceptRareDeaths", "countLevels"].includes(key2) && !ui.busy) {
      if (["goldWeight", "acceptRareDeaths", "countLevels"].includes(key2)) rerateUpgrades();
      else if (ui.upgradeResult) {
        ui.plan = buildPlan(ui.upgradeResult, Number(ui.settings.budget) || 0, ui.settings.spending);
        ui.verified = null;
      }
      render3();
    }
  }
  var dotTimer = null;
  function scheduleDot() {
    clearTimeout(dotTimer);
    dotTimer = setTimeout(updateAlertDot, 500);
  }
  function mountUI(win2, workerSource) {
    ui.win = win2;
    ui.workerSource = workerSource;
    setExportContext(exportContext);
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    const button2 = document.createElement("button");
    button2.className = "mwia-launcher";
    button2.title = "MWI Advisor";
    button2.setAttribute("aria-label", "MWI Advisor");
    button2.textContent = "\u{1F9ED}";
    document.body.appendChild(button2);
    makeDraggable(button2);
    ui.launcher = button2;
    const root = document.createElement("div");
    root.className = "mwia-panel mwia-hidden";
    root.innerHTML = `
      <div class="mwia-header">
        <div><b>\u{1F9ED} MWI Advisor</b> <span class="mwia-status mwia-dim"></span></div>
        <button class="mwia-link" data-action="close" title="Close">\u2715</button>
      </div>
      <nav class="mwia-tabs">
        <button class="mwia-tab" data-tab="overview">Overview</button>
        <button class="mwia-tab" data-tab="zones">Where to fight</button>
        <button class="mwia-tab" data-tab="upgrades">Upgrades</button>
        <button class="mwia-tab" data-tab="skilling">Skilling</button>
        <button class="mwia-tab" data-tab="horizon">\u{1F4C8} Plan</button>
        <button class="mwia-tab" data-tab="market">Market</button>
        <button class="mwia-tab" data-tab="labyrinth">Labyrinth</button>
        <button class="mwia-tab" data-tab="guide">Guide</button>
      </nav>
      <div class="mwia-body"></div>`;
    document.body.appendChild(root);
    const gameDeps = {
      settings: () => ui.settings,
      prepare: async () => {
        await loadClientData(ui.win);
        await loadPrices();
      },
      addToCart: (items) => addToCart(ui.win, items)
    };
    startConsumableGuide(gameDeps);
    startJobLog(gameDeps);
    startToolNotice(gameDeps);
    startTeaSlots(gameDeps);
    startLoadoutAdvice({ settings: () => ui.settings, prepare: gameDeps.prepare, busy: () => ui.busy, profileOf: loadoutProfile, analyze: adviseLoadout, addToCart: gameDeps.addToCart });
    startLabyrinthMarks({ level: () => roomLevelSetting(ui.settings), prepare: gameDeps.prepare });
    startLabyrinthLog({ predict: roomPrediction });
    startEnhancePlan(gameDeps);
    startHorizonSync({ settings: () => ui.settings, prepare: () => loadClientData(ui.win) });
    onHorizonChange(() => {
      scheduleDot();
      if (!root.classList.contains("mwia-hidden") && !ui.busy && ui.tab === "horizon") render3();
    });
    watchTriggerClicks();
    startTriggerWindow({
      advice: (hrid) => loadTriggerAdvice()[hrid] || null,
      describe: (triggers) => describeTriggers(triggers, getClientData() || {}),
      name: (hrid) => hrid.startsWith("/items/") ? itemName(hrid) : abilityName(hrid),
      onReport: (diag, copied) => {
        ui.tab = "upgrades";
        ui.notice = { level: "info", text: `The game's trigger window, read (nothing changed)${copied ? " and copied" : ""}. Paste it into the chat.`, diag };
        render3();
      }
    });
    ui.root = root;
    root.addEventListener("click", onClick9);
    root.addEventListener("change", onChange);
    root.addEventListener("toggle", rememberToggle, true);
    enableTapTips(root);
    root.addEventListener("input", (event) => {
      if (!["goldWeight", "skillingGold"].includes(event.target.dataset?.setting)) return;
      const label3 = event.target.closest(".mwia-focus")?.querySelector(".mwia-focus-text");
      if (label3) label3.textContent = focusText(Number(event.target.value));
    });
    button2.addEventListener("click", async () => {
      const opening2 = root.classList.contains("mwia-hidden");
      if (!opening2) {
        root.classList.add("mwia-hidden");
        return;
      }
      if (!getClientData()) {
        try {
          await loadClientData(win2);
        } catch (error) {
          ui.error = error.message;
        }
      }
      showPanel();
    });
    onHistoryChange(() => {
      if (!root.classList.contains("mwia-hidden") && !ui.busy && ui.tab === "skilling") render3();
    });
    onAttemptsChanged(() => {
      if (!root.classList.contains("mwia-hidden") && !ui.busy && ui.tab === "labyrinth") render3();
    });
    onStateChange(() => {
      if (!root.classList.contains("mwia-hidden") && !ui.busy) {
        root.querySelector(".mwia-status").innerHTML = statusLine();
      }
      scheduleDot();
    });
    onPricesLoaded(() => scheduleDot());
    setTimeout(refreshMarket, MARKET_FIRST_CHECK_MS);
    setInterval(refreshMarket, MARKET_REFRESH_MS);
  }

  // src/listing-price-ui.js
  var MODAL = '[class*="Modal_modalContainer"],[class*="MarketplacePanel_modalContent"]';
  var HEADER = '[class*="MarketplacePanel_header"]';
  var PRICE_INPUTS = '[class*="MarketplacePanel_priceInputs"]';
  var BEST = '[class*="MarketplacePanel_bestPrice"]';
  var SCAN_MS10 = 300;
  var BOOK_OLD_MS = 10 * 60 * 1e3;
  var LABELS = { match: "Match", wall: "Wall" };
  var label2 = (s2) => s2.kind === "horizon" ? `<${s2.horizon}h` : LABELS[s2.kind];
  var l = { win: null, scanTimer: null, loading: null, loadError: null, applying: false, cache: { key: null, prices: null }, clicked: null };
  var num = (n5) => Math.round(n5).toLocaleString("en-US");
  var numberIn = (text) => {
    const found = String(text).match(/\d[\d\s,.]*[kmb]?/gi);
    return found ? parseCoins(found[found.length - 1].trim()) : null;
  };
  var tick = () => new Promise((resolve2) => requestAnimationFrame(() => resolve2()));
  function startListingPrices(win2) {
    l.win = win2;
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(".mwia-listprice"))) return;
      scheduleScan11();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick10, true);
    document.addEventListener("input", (event) => {
      if (event.target.closest?.(MODAL)) scheduleScan11();
    }, true);
  }
  var POST = /^post (sell|buy) listing$/i;
  var VERSION4 = typeof GM_info !== "undefined" ? GM_info.script?.version || "" : "";
  function listingModals() {
    const found = /* @__PURE__ */ new Set();
    const anchors = [...document.querySelectorAll(PRICE_INPUTS), ...[...document.querySelectorAll("button")].filter((b) => POST.test(b.textContent.trim()))];
    for (const anchor of anchors) {
      if (!visible(anchor)) continue;
      let modal = anchor.closest(MODAL);
      for (let el = anchor.parentElement; !modal && el && el !== document.body; el = el.parentElement) {
        if ([...el.querySelectorAll("button")].some((b) => POST.test(b.textContent.trim())) && el.querySelector("input")) modal = el;
      }
      if (modal) found.add(modal);
    }
    return [...found];
  }
  function scheduleScan11() {
    if (l.scanTimer) return;
    l.scanTimer = setTimeout(() => {
      l.scanTimer = null;
      try {
        scan9();
      } catch (error) {
        console.warn("[MWI Advisor] listing prices", error);
      }
    }, SCAN_MS10);
  }
  function readModal(modal) {
    const header = modal.querySelector(HEADER)?.textContent || "";
    const post = [...modal.querySelectorAll("button")].map((b) => POST.exec(b.textContent.trim())).find(Boolean);
    const said = /sell listing|sell order/i.test(header) ? "sell" : /buy listing|buy order/i.test(header) ? "buy" : null;
    const side = said || (post ? post[1].toLowerCase() : null);
    if (!side) return null;
    const inputs = modal.querySelector(PRICE_INPUTS);
    if (!inputs) return { error: `no price box found (inputs: ${modal.querySelectorAll("input").length})` };
    const input = inputs.querySelector("input");
    const items = getClientData()?.itemDetailMap || {};
    const hrid = [...modal.querySelectorAll("svg use")].map((use) => "/items/" + (use.getAttribute("href") || use.getAttribute("xlink:href") || "").split("#").pop()).find((candidate) => items[candidate] && candidate !== "/items/coin");
    if (!hrid) return { error: `no item icon found (icons: ${[...modal.querySelectorAll("svg use")].map((use) => (use.getAttribute("href") || use.getAttribute("xlink:href") || "?").split("/").pop()).join(", ") || "none"})` };
    const text = modal.textContent || "";
    const SUFFIX = "(?:[kKmMbB](?![a-z]))?";
    const range = new RegExp(`[Tt]radable [Rr]ange:\\s*(\\d[\\d\\s,.]*${SUFFIX})\\s*[\u2013-]\\s*(\\d[\\d\\s,.]*${SUFFIX})`).exec(text);
    const min = range ? parseCoins(range[1]) : null;
    const max = range ? parseCoins(range[2]) : null;
    const level = inputAfter(modal, /^enhancement level$/i);
    const quantity = inputAfter(modal, /^quantity\b/i);
    return {
      side,
      hrid,
      level: level ? Number(level.value) || 0 : 0,
      quantity: Math.max(1, quantity && numberIn(quantity.value) || 1),
      inputs,
      input,
      best: numberIn(modal.querySelector(BEST)?.textContent || ""),
      // A range that reads upside down was misread: left out (the order book's is used).
      range: min !== null && max !== null && min <= max ? { min, max, rounded: /[kmb]/i.test(range[1] + range[2]) } : null
    };
  }
  function inputAfter(modal, pattern) {
    const label3 = [...modal.querySelectorAll("*")].find((el) => !el.children.length && pattern.test(el.textContent.trim()));
    return label3 && [...modal.querySelectorAll("input")].find((el) => label3.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
  }
  function ownListings(hrid, side, level = 0) {
    return (state.character?.myMarketListings || []).filter((listing) => listing.itemHrid === hrid && (listing.enhancementLevel || 0) === level && !!listing.isSell === (side === "sell")).map((listing) => ({ price: Number(listing.price) || 0, quantity: Math.max(0, (listing.orderQuantity || 0) - (listing.filledQuantity || 0)) }));
  }
  function context(modal) {
    const m2 = readModal(modal);
    if (!m2 || m2.error) return m2;
    const book = orderBookAt(m2.hrid, m2.level);
    const range = m2.range?.rounded && book?.range || m2.range || book?.range || null;
    const own = ownListings(m2.hrid, m2.side, m2.level);
    const key2 = JSON.stringify([m2.side, m2.hrid, m2.level, m2.quantity, m2.best, range, book?.at, own, historyVersion()]);
    if (l.cache.key !== key2) {
      l.cache = { key: key2, prices: listingPrices({ side: m2.side, book, own, best: m2.best, range, summary: priceSummary(m2.hrid, m2.level), hours: recentHours(m2.hrid, m2.level), quantity: m2.quantity }) };
    }
    return { ...m2, book, range, ...l.cache.prices, limit: m2.side === "buy" && m2.level === 0 ? profitLimit(m2.hrid, range, book) : null };
  }
  function profitLimit(hrid, range, book) {
    const limit = buyLimit(hrid);
    if (!limit) return null;
    let price = Math.floor(limit.price);
    let capped = null;
    if (range && price > range.max) [price, capped] = [range.max, "max"];
    const under = !!range && price < range.min;
    const listed = book ? book.asks.filter((o2) => o2.price <= price).reduce((sum, o2) => sum + o2.quantity, 0) : null;
    return { ...limit, price: under ? null : price, exact: limit.price, capped, under, listed };
  }
  function scan9() {
    const modals = listingModals();
    if (modals.length && !getClientData() && !l.loadError) {
      l.loading || (l.loading = loadClientData(l.win).then(scheduleScan11, (error) => {
        l.loadError = String(error?.message || error);
        scheduleScan11();
      }).finally(() => l.loading = null));
      return;
    }
    if (modals.length) setTimeout(scheduleScan11, 700);
    for (const modal of modals) {
      let c2;
      try {
        c2 = getClientData() ? context(modal) : { error: `no game data (${l.loadError})` };
      } catch (error) {
        c2 = { error: String(error?.message || error) };
      }
      let box = modal.querySelector(".mwia-listprice");
      if (!c2) {
        box?.remove();
        continue;
      }
      if (!box) {
        box = document.createElement("div");
        box.className = "mwia-listprice";
        const inputs = modal.querySelector(PRICE_INPUTS);
        const post = [...modal.querySelectorAll("button")].find((b) => POST.test(b.textContent.trim()));
        if (inputs) inputs.insertAdjacentElement("afterend", box);
        else if (post) post.insertAdjacentElement("beforebegin", box);
        else modal.appendChild(box);
      }
      if (!c2.error) notePrediction(prediction(c2));
      const html = c2.error ? `<div class="mwia-listprice-info">MWI Advisor ${esc(VERSION4)} can't read this window: ${esc(c2.error)}. A screenshot of this helps.</div>` : boxHtml4(c2);
      if (box.dataset.html !== html) {
        box.dataset.html = html;
        box.innerHTML = html;
      }
    }
  }
  function boxHtml4(c2) {
    const sell = c2.side === "sell";
    const buttons = c2.suggestions.map((s2, i) => {
      const shown = s2.price === null ? "\u2014" : s2.kind === "wall" || s2.under ? `${sell ? "<" : ">"} ${shortCoins(s2.price)}` : shortCoins(s2.price);
      return `<button type="button" data-listprice="${i}"${s2.price === null ? ' class="mwia-off"' : ""} title="${esc(titleFor(s2, c2))}"><b>${label2(s2)}</b><small>${shown}</small></button>`;
    });
    return `${limitHtml(c2)}${buttons.length ? `<div class="mwia-listprice-buttons">${buttons.join("")}</div>` : ""}<div class="mwia-listprice-info">${infoHtml(c2)}</div>`;
  }
  function limitHtml(c2) {
    const t4 = c2.limit;
    if (!t4) return "";
    const margin = `${Math.round(t4.margin * 100)}%`;
    const shown = t4.price === null ? "\u2014" : `\u2264 ${shortCoins(t4.price)}`;
    return `<button type="button" class="mwia-listprice-limit${t4.price === null ? " mwia-off" : ""}" data-listprice="limit" title="${esc(limitTitle(t4, c2))}"><b>\u{1F9ED} Profit ${shown}</b><small>keeps ${margin} on ${esc(t4.job)}</small></button>`;
  }
  function limitTitle(t4, c2) {
    const margin = `${Math.round(t4.margin * 100)}%`;
    if (t4.price === null) return `${t4.job} needs ${itemName(c2.hrid)} at ${num(t4.exact)} or less to keep a ${margin} margin \u2013 under the tradable range (from ${num(c2.range.min)}). Nothing can be bought at a profit now.`;
    const cap3 = t4.capped ? ` The tradable range stops at ${num(t4.price)}, under the ${num(t4.exact)} the margin allows.` : "";
    const now2 = t4.listed === null ? `Open ${itemName(c2.hrid)} on the market to see how many are listed under it.` : t4.listed > 0 ? `${num(t4.listed)} listed at or under it now are bought at once, the cheapest first; the rest waits as a buy order at this price.` : `Nobody lists it that cheap now: the order waits for sellers.`;
    return `The most ${itemName(c2.hrid)} may cost with the last action of ${t4.job} still making ${margin} (the other materials at their lowest ask).${cap3} ${now2} Worked out with the Skilling tab's prices ${Math.max(0, Math.round((Date.now() - t4.at) / 6e4))} min ago.`;
  }
  function titleFor(s2, c2) {
    const sell = c2.side === "sell";
    const cap3 = s2.capped ? ` (the tradable range's ${s2.capped})` : "";
    if (s2.kind === "match") return `The best ${sell ? "sell" : "buy"} offer now: ${num(s2.price)}${cap3}.`;
    if (s2.kind === "wall") return `One step ${sell ? "under" : "over"} ${num(s2.wall.quantity)} at ${num(s2.price)}, the first level with a fifth of all ${sell ? "listed" : "bid"}; ${num(s2.wall.ahead)} lie in front of it.`;
    return horizonTitle(s2, c2);
  }
  function prediction(c2) {
    const key2 = `${c2.side}|${c2.hrid}|${c2.level}`;
    const button2 = (s2) => s2.kind === "horizon" ? { h: s2.horizon, price: s2.price, under: !!s2.under, chance: s2.chance ?? null, windows: s2.windows ?? null, need: s2.need ?? null, why: s2.why ?? null } : { kind: s2.kind, price: s2.price };
    return {
      side: c2.side,
      item: c2.hrid,
      level: c2.level,
      quantity: c2.quantity,
      best: c2.best,
      othersBest: c2.book ? c2.levels[0]?.price ?? null : null,
      bookAt: c2.book?.at ?? null,
      takenPerHour: c2.taken?.perHour ?? null,
      usual: c2.usual,
      buttons: c2.suggestions.map(button2),
      clicked: l.clicked?.key === key2 && Date.now() - l.clicked.at < PREDICTION_MS ? l.clicked.kind : null
    };
  }
  function horizonTitle(s2, c2) {
    const sell = c2.side === "sell";
    const goes = sell ? "sells" : "is bought";
    const pct6 = (share) => `${Math.round(share * 100)}%`;
    const rate2 = c2.taken ? `${sell ? "Buyers take" : "Sellers fill"} about ${num(c2.taken.perHour)} an hour from ${sell ? "sell" : "buy"} listings.` : "How many trade an hour isn't known yet, so the quantity isn't counted.";
    if (s2.price === null) {
      if (s2.why === "quantity") return `${num(c2.quantity)} is about ${num(c2.quantity / c2.taken.perHour)} h of what ${sell ? "buyers take" : "sellers fill"} (${num(c2.taken.perHour)} an hour): ${pct6(FILLED)} of it can't go within ${s2.horizon} h at any price.`;
      if (s2.why === "history") return `Needs more hourly prices: ${s2.windows} of the 12 stretches of ${s2.horizon} h it looks back on so far.`;
      if (s2.need > 1) return `${pct6(FILLED)} of ${num(c2.quantity)} takes about ${num(s2.need)} h first in line (${num(c2.taken.perHour)} an hour): no price was first in line that long in ${pct6(CONFIDENCE)} of past stretches of ${s2.horizon} h.`;
      return `No price ${goes} within ${s2.horizon} h often enough.`;
    }
    const where = s2.under ? `One step ${sell ? "under" : "over"} the best offer (${num(s2.price)}): first in line now.` : `At ${num(s2.price)}.`;
    return `${where} A ${pct6(CONFIDENCE)} chance that ${pct6(FILLED)} of ${num(c2.quantity)} ${goes} within ${s2.horizon} h \u2013 it did in ${pct6(s2.chance)} of ${s2.windows} past stretches of ${s2.horizon} h. ${rate2}`;
  }
  function infoHtml(c2) {
    const sell = c2.side === "sell";
    const price = priceIn(c2);
    const parts = [];
    if (price > 0 && c2.book) {
      const { better: better2, same: same2 } = standing(price, c2.levels, c2.side);
      parts.push(`${num(better2)} ${sell ? "listed cheaper" : "bid higher"}${same2 ? `, ${num(same2)} at ${num(price)}` : ""}`);
      const age = Date.now() - c2.book.at;
      if (age > BOOK_OLD_MS) parts.push(`order book ${Math.round(age / 6e4)} min old`);
      const top = (sell ? c2.book.asks : c2.book.bids)[0]?.price;
      if (c2.best > 0 && top > 0 && top !== c2.best) parts.push(`the order book's best (${num(top)}) isn't the window's \u2013 open ${esc(itemName(c2.hrid))}${c2.level ? ` +${c2.level}` : ""} on the market again`);
    } else if (!c2.book) parts.push(`open ${esc(itemName(c2.hrid))}${c2.level ? ` +${c2.level}` : ""} on the market for the order book`);
    const vs = price > 0 ? versusUsual(price, c2.usual) : null;
    if (vs) parts.push(`${vs.diff >= 0 ? "+" : "\u2212"}${Math.abs(Math.round(vs.diff * 100))}% vs usual ${sell ? "ask" : "bid"} (${num(c2.usual)})`);
    else if (!c2.usual) parts.push(`usual price after 12 h of prices${c2.hours ? ` (${c2.hours} so far)` : ""}`);
    return parts.join(" \xB7 ");
  }
  function priceIn(c2) {
    if (c2.input) return numberIn(c2.input.value);
    const text = [...c2.inputs.childNodes].filter((node) => node.nodeName !== "BUTTON").map((node) => node.textContent).join(" ");
    return numberIn(text);
  }
  function controls(c2) {
    const buttons = [...c2.inputs.querySelectorAll("button")];
    const by = (pattern) => buttons.find((b) => pattern.test(b.textContent.trim()));
    return { minus: by(/^[-−]$/), plus: by(/^\+$/), min: by(/^min$/i), max: by(/^max$/i) };
  }
  var MAX_STEPS = 400;
  async function press(c2, button2) {
    const before = priceIn(c2);
    button2.click();
    for (let i = 0; i < 10; i++) {
      await tick();
      const now2 = priceIn(c2);
      if (now2 !== before) return now2;
    }
    return null;
  }
  async function stepTo(c2, b, target, up = false) {
    let price = priceIn(c2);
    for (let i = 0; i < MAX_STEPS && price !== null; i++) {
      if (price === target) return price;
      if (price < target) {
        const next = await press(c2, b.plus);
        if (next === null) return price;
        if (next > target) return up ? next : press(c2, b.minus).then((back) => back ?? next);
        price = next;
      } else {
        const next = await press(c2, b.minus);
        if (next === null) return price;
        if (next < target) return up ? press(c2, b.plus).then((back) => back ?? next) : next;
        price = next;
      }
    }
    return price;
  }
  async function apply(modal, index) {
    const c2 = context(modal);
    const s2 = index === "limit" ? c2?.limit && { kind: "profit", price: c2.limit.price, capped: c2.limit.capped, step: 0 } : c2?.suggestions?.[index];
    if (!s2 || s2.price === null || l.applying) return;
    l.clicked = { key: `${c2.side}|${c2.hrid}|${c2.level}`, kind: s2.kind === "horizon" ? `<${s2.horizon}h` : s2.kind, at: Date.now() };
    l.applying = true;
    try {
      const b = controls(c2);
      if (s2.capped === "max" && b.max) await press(c2, b.max);
      else if (s2.capped === "min" && b.min) await press(c2, b.min);
      else if (b.plus && b.minus) {
        const target = Math.round(s2.price);
        if (c2.input) {
          setReactInput(c2.input, target);
          await tick();
        }
        const reached = await stepTo(c2, b, target, s2.step > 0);
        if (s2.step && reached === target) await press(c2, s2.step < 0 ? b.minus : b.plus);
      } else if (c2.input) setReactInput(c2.input, Math.round(s2.price));
    } finally {
      l.applying = false;
    }
    scheduleScan11();
  }
  function onClick10(event) {
    const button2 = event.target.closest?.(".mwia-listprice [data-listprice]");
    if (!button2) return;
    event.preventDefault();
    event.stopPropagation();
    if (isTouch() || button2.classList.contains("mwia-off")) showTip(button2, button2.title);
    const index = button2.dataset.listprice;
    apply(listingModals().find((modal) => modal.contains(button2)), index === "limit" ? index : Number(index));
  }

  // src/main.js
  var win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  installSocketHook(win);
  usePageWindow(win);
  startOrderLog();
  readPairing(win);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mount());
  } else {
    mount();
  }
  function mount() {
    mountUI(win, worker_source_default);
    mountPlanTrain(win);
    mountEnhanceLoop(win);
    startPriceHistory(win);
    startListingPrices(win);
    startVersionTag();
    startExportButton(win);
  }
})();

// ---- Third-party licences ----
// MWICombatSimulator (engine/):
// MIT License
// 
// Copyright (c) 2024 AmVoidGuy
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// heap-js:
// BSD 3-Clause License
// 
// Copyright (c) 2017, Ignacio Lago
// All rights reserved.
// 
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
// 
// * Redistributions of source code must retain the above copyright notice, this
//   list of conditions and the following disclaimer.
// 
// * Redistributions in binary form must reproduce the above copyright notice,
//   this list of conditions and the following disclaimer in the documentation
//   and/or other materials provided with the distribution.
// 
// * Neither the name of the copyright holder nor the names of its
//   contributors may be used to endorse or promote products derived from
//   this software without specific prior written permission.
// 
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
// CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
// OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

