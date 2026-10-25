// ==UserScript==
// @name         MWI Combat Advisor
// @namespace    local.mwi-combat-advisor
// @version      0.25.0
// @description  Recommends zones, gear, abilities, food and drinks for Milky Way Idle combat by simulating your own character.
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
  var worker_source_default = '(()=>{var ea=Object.defineProperty;var aa=(o,t,e)=>t in o?ea(o,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):o[t]=e;var u=(o,t,e)=>aa(o,typeof t!="symbol"?t+"":t,e);var ia=new Set(["enhancementLevelTotalBonusMultiplierTable","abilitySlotsLevelRequirementList"]),It=globalThis.__MWIA_DATA||(globalThis.__MWIA_DATA={});function S(o){return It[o]||(It[o]=ia.has(o)?[]:{}),It[o]}function ke(o){for(let[t,e]of Object.entries(o)){let a=S(t);if(Array.isArray(a))a.length=0,a.push(...e);else{for(let i of Object.keys(a))delete a[i];Object.assign(a,e)}}}var Pt=class o{static getTarget(t){return t?t.find(a=>a.combatDetails.currentHitpoints>0)??null:null}static randomInt(t,e){if(e<t){let f=t;t=e,e=f}let a=Math.ceil(t),i=Math.floor(e);if(Math.floor(t)==i)return Math.floor((t+e)/2+Math.random());let s=-1*(t-a),r=e-i,n=2*s+(i-a),c=(i+a)/2,l=(e+t)/2,h=n*(l-c)/(i+1-l),m=Math.abs(h/(h+n));return Math.random()<m?r>s?Math.floor(i+1):Math.floor(a-1):r>s?Math.floor(t+Math.random()*(i+s-t+1)):Math.floor(a-r+Math.random()*(e-(a-r)+1))}static processAttack(t,e,a=null){let i=a?a.combatStyleHrid:t.combatDetails.combatStats.combatStyleHrid,s=a?a.damageType:t.combatDetails.combatStats.damageType,r=1,n=1,c=1;switch(i){case"/combat_styles/stab":r=t.combatDetails.stabAccuracyRating,n=t.combatDetails.stabMaxDamage,c=e.combatDetails.stabEvasionRating;break;case"/combat_styles/slash":r=t.combatDetails.slashAccuracyRating,n=t.combatDetails.slashMaxDamage,c=e.combatDetails.slashEvasionRating;break;case"/combat_styles/smash":r=t.combatDetails.smashAccuracyRating,n=t.combatDetails.smashMaxDamage,c=e.combatDetails.smashEvasionRating;break;case"/combat_styles/ranged":r=t.combatDetails.rangedAccuracyRating,n=t.combatDetails.rangedMaxDamage,c=e.combatDetails.rangedEvasionRating;break;case"/combat_styles/magic":r=t.combatDetails.magicAccuracyRating,n=t.combatDetails.magicMaxDamage,c=e.combatDetails.magicEvasionRating;break;default:throw new Error("Unknown combat style: "+i)}let l=1,h=0,m=0,f=0,p=0,y=0,b;switch(s){case"/damage_types/physical":l=1+t.combatDetails.combatStats.physicalAmplify,h=t.combatDetails.totalArmor,m=t.combatDetails.combatStats.armorPenetration,f=e.combatDetails.totalArmor,p=e.combatDetails.combatStats.physicalThorns,y=e.combatDetails.combatStats.armorPenetration,b="physicalThorns";break;case"/damage_types/water":l=1+t.combatDetails.combatStats.waterAmplify,h=t.combatDetails.totalWaterResistance,m=t.combatDetails.combatStats.waterPenetration,f=e.combatDetails.totalWaterResistance,p=e.combatDetails.combatStats.elementalThorns,y=e.combatDetails.combatStats.waterPenetration,b="elementalThorns";break;case"/damage_types/nature":l=1+t.combatDetails.combatStats.natureAmplify,h=t.combatDetails.totalNatureResistance,m=t.combatDetails.combatStats.naturePenetration,f=e.combatDetails.totalNatureResistance,p=e.combatDetails.combatStats.elementalThorns,y=e.combatDetails.combatStats.naturePenetration,b="elementalThorns";break;case"/damage_types/fire":l=1+t.combatDetails.combatStats.fireAmplify,h=t.combatDetails.totalFireResistance,m=t.combatDetails.combatStats.firePenetration,f=e.combatDetails.totalFireResistance,p=e.combatDetails.combatStats.elementalThorns,y=e.combatDetails.combatStats.firePenetration,b="elementalThorns";break;default:throw new Error("Unknown damage type: "+s)}let T=1,Q=0,ht=!1,mt=t.combatDetails.combatStats.criticalRate,ut=t.combatDetails.combatStats.criticalDamage;a&&(r*=1+a.bonusAccuracyRatio),t.isWeakened&&(r=r-t.weakenPercentage*r),T=Math.pow(r,1.4)/(Math.pow(r,1.4)+Math.pow(c,1.4)),i=="/combat_styles/ranged"&&(Q=.3*T),Q=Q+mt;let tt=a?a.damageFlat:0,pt=a?a.damageRatio:1,et=a?a.armorDamageRatio*t.combatDetails.totalArmor:0,W=l*(1+tt+et),O=l*(pt*n+tt+et);Math.random()<Q&&(O=O*(1+ut),W=O,ht=!0);let d=o.randomInt(W,O);d*=1+t.combatDetails.combatStats.taskDamage,d*=1+e.combatDetails.combatStats.damageTaken,a?d*=1+t.combatDetails.combatStats.abilityDamage:d+=d*t.combatDetails.combatStats.autoAttackDamage;let R=0,L=0,I=!1;if(Math.random()<T){I=!0;let x=f;m>0&&f>0&&(x=f/(1+m));let B=100/(100+x);x<0&&(B=(100-x)/100);let G=Math.ceil(B*d);R=Math.min(G,e.combatDetails.currentHitpoints),e.combatDetails.currentHitpoints-=R}if(p>0&&f>-99){let x=h;h>0&&(x=h/(1+y));let B=100/(100+x);x<0&&(B=(100-x)/100);let G=1+e.combatDetails.combatStats.taskDamage,Ot=1+t.combatDetails.combatStats.damageTaken,Lt=G*Ot,ft=o.randomInt(1,Lt*e.combatDetails.defensiveMaxDamage*(1+f/100)*p),K=Math.ceil(B*ft);L=Math.min(K,t.combatDetails.currentHitpoints),t.combatDetails.currentHitpoints-=L}let Ct=0;if(e.combatDetails.combatStats.retaliation>0&&Math.pow(e.combatDetails.smashAccuracyRating,1.4)/(Math.pow(e.combatDetails.smashAccuracyRating,1.4)+Math.pow(t.combatDetails.smashEvasionRating,1.4))>Math.random()){let B=t.combatDetails.totalArmor;B>0&&(B=B/(1+e.combatDetails.combatStats.armorPenetration));let G=100/(100+B);B<0&&(G=(100-B)/100);let Ot=1+e.combatDetails.combatStats.taskDamage,Lt=1+t.combatDetails.combatStats.damageTaken,ft=Ot*Lt,K=d;K=Math.min(K,e.combatDetails.defensiveMaxDamage*5);let $e=ft*e.combatDetails.combatStats.retaliation*K,Je=ft*e.combatDetails.combatStats.retaliation*(e.combatDetails.defensiveMaxDamage+K),Xe=o.randomInt($e,Je),ta=Math.ceil(G*Xe);Ct=Math.min(ta,t.combatDetails.currentHitpoints),t.combatDetails.currentHitpoints-=Ct}let xe=0;!a&&I&&t.combatDetails.combatStats.lifeSteal>0&&(xe=t.addHitpoints(Math.floor(t.combatDetails.combatStats.lifeSteal*R)));let Be=0;if(a&&I&&a.hpDrainRatio>0){let x=1+t.combatDetails.combatStats.healingAmplify;Be=t.addHitpoints(Math.floor(a.hpDrainRatio*R*x))}let He=0;return!a&&I&&t.combatDetails.combatStats.manaLeech>0&&(He=t.addManapoints(Math.floor(t.combatDetails.combatStats.manaLeech*R))),{damageDone:R,didHit:I,thornDamageDone:L,thornType:b,retaliationDamageDone:Ct,lifeStealHeal:xe,hpDrain:Be,manaLeechMana:He,isCrit:ht}}static processHeal(t,e,a){if(e.combatStyleHrid!="/combat_styles/magic")throw new Error("Heal ability effect not supported for combat style: "+e.combatStyleHrid);let i=1+t.combatDetails.combatStats.healingAmplify,s=t.combatDetails.magicMaxDamage,r=e.damageFlat,n=e.damageRatio,c=i*(1+r),l=i*(n*s+r),h=this.randomInt(c,l);return a.addHitpoints(h)}static processRevive(t,e,a){if(e.combatStyleHrid!="/combat_styles/magic")throw new Error("Heal ability effect not supported for combat style: "+e.combatStyleHrid);let i=1+t.combatDetails.combatStats.healingAmplify,s=t.combatDetails.magicMaxDamage,r=e.damageFlat,n=e.damageRatio,c=i*(1+r),l=i*(n*s+r),h=this.randomInt(c,l),m=a.addHitpoints(h);return a.combatDetails.currentManapoints=a.combatDetails.maxManapoints,a.clearCCs(),m}static processSpendHp(t,e){let a=t.combatDetails.currentHitpoints,i=e.spendHpRatio,s=Math.floor(a*i);return t.combatDetails.currentHitpoints-=s,s}static calculateTickValue(t,e,a){let i=Math.floor(a*t/e),s=Math.floor((a-1)*t/e);return i-s}},A=Pt;var Nt=class{constructor(t,e){this.type=t,this.time=e}},g=Nt;var dt=class dt extends g{constructor(t,e){super(dt.type,t),this.source=e}};u(dt,"type","autoAttack");var qt=dt,k=qt;var bt=class bt extends g{constructor(t,e,a,i,s,r,n){super(bt.type,t),this.sourceRef=e,this.target=a,this.damage=i,this.totalTicks=s,this.currentTick=r,this.combatStyleHrid=n}};u(bt,"type","damageOverTime");var Ft=bt,at=Ft;var gt=class gt extends g{constructor(t,e){super(gt.type,t),this.source=e}};u(gt,"type","checkBuffExpiration");var Qt=gt,j=Qt;var yt=class yt extends g{constructor(t){super(yt.type,t)}};u(yt,"type","combatStart");var Ut=yt,it=Ut;var Dt=class Dt extends g{constructor(t,e,a,i,s){super(Dt.type,t),this.source=e,this.consumable=a,this.totalTicks=i,this.currentTick=s}};u(Dt,"type","consumableTick");var zt=Dt,st=zt;var vt=class vt extends g{constructor(t){super(vt.type,t)}};u(vt,"type","cooldownReady");var Wt=vt,Gt=Wt;var Tt=class Tt extends g{constructor(t){super(Tt.type,t)}};u(Tt,"type","enemyRespawn");var Kt=Tt,jt=Kt;var v=function(o,t,e,a){function i(s){return s instanceof e?s:new e(function(r){r(s)})}return new(e||(e=Promise))(function(s,r){function n(h){try{l(a.next(h))}catch(m){r(m)}}function c(h){try{l(a.throw(h))}catch(m){r(m)}}function l(h){h.done?s(h.value):i(h.value).then(n,c)}l((a=a.apply(o,t||[])).next())})},D=function(o,t){var e={label:0,sent:function(){if(s[0]&1)throw s[1];return s[1]},trys:[],ops:[]},a,i,s,r=Object.create((typeof Iterator=="function"?Iterator:Object).prototype);return r.next=n(0),r.throw=n(1),r.return=n(2),typeof Symbol=="function"&&(r[Symbol.iterator]=function(){return this}),r;function n(l){return function(h){return c([l,h])}}function c(l){if(a)throw new TypeError("Generator is already executing.");for(;r&&(r=0,l[0]&&(e=0)),e;)try{if(a=1,i&&(s=l[0]&2?i.return:l[0]?i.throw||((s=i.return)&&s.call(i),0):i.next)&&!(s=s.call(i,l[1])).done)return s;switch(i=0,s&&(l=[l[0]&2,s.value]),l[0]){case 0:case 1:s=l;break;case 4:return e.label++,{value:l[1],done:!1};case 5:e.label++,i=l[1],l=[0];continue;case 7:l=e.ops.pop(),e.trys.pop();continue;default:if(s=e.trys,!(s=s.length>0&&s[s.length-1])&&(l[0]===6||l[0]===2)){e=0;continue}if(l[0]===3&&(!s||l[1]>s[0]&&l[1]<s[3])){e.label=l[1];break}if(l[0]===6&&e.label<s[1]){e.label=s[1],s=l;break}if(s&&e.label<s[2]){e.label=s[2],e.ops.push(l);break}s[2]&&e.ops.pop(),e.trys.pop();continue}l=t.call(o,e)}catch(h){l=[6,h],i=0}finally{a=s=0}if(l[0]&5)throw l[1];return{value:l[0]?l[1]:void 0,done:!0}}},E=function(o,t){var e=typeof Symbol=="function"&&o[Symbol.iterator];if(!e)return o;var a=e.call(o),i,s=[],r;try{for(;(t===void 0||t-- >0)&&!(i=a.next()).done;)s.push(i.value)}catch(n){r={error:n}}finally{try{i&&!i.done&&(e=a.return)&&e.call(a)}finally{if(r)throw r.error}}return s},H=function(o,t,e){if(e||arguments.length===2)for(var a=0,i=t.length,s;a<i;a++)(s||!(a in t))&&(s||(s=Array.prototype.slice.call(t,0,a)),s[a]=t[a]);return o.concat(s||Array.prototype.slice.call(t))},Me=function(o){var t=typeof Symbol=="function"&&Symbol.iterator,e=t&&o[t],a=0;if(e)return e.call(o);if(o&&typeof o.length=="number")return{next:function(){return o&&a>=o.length&&(o=void 0),{value:o&&o[a++],done:!o}}};throw new TypeError(t?"Object is not iterable.":"Symbol.iterator is not defined.")},La=(function(){function o(t){t===void 0&&(t=o.minComparator);var e=this;this.compare=t,this.heapArray=[],this._limit=0,this.offer=this.add,this.element=this.peek,this.poll=this.pop,this._invertedCompare=function(a,i){return e.compare(a,i).then(function(s){return-1*s})}}return o.getChildrenIndexOf=function(t){return[t*2+1,t*2+2]},o.getParentIndexOf=function(t){if(t<=0)return-1;var e=t%2?1:2;return Math.floor((t-e)/2)},o.getSiblingIndexOf=function(t){if(t<=0)return-1;var e=t%2?1:-1;return t+e},o.minComparator=function(t,e){return v(this,void 0,void 0,function(){return D(this,function(a){return t>e?[2,1]:t<e?[2,-1]:[2,0]})})},o.maxComparator=function(t,e){return v(this,void 0,void 0,function(){return D(this,function(a){return e>t?[2,1]:e<t?[2,-1]:[2,0]})})},o.minComparatorNumber=function(t,e){return v(this,void 0,void 0,function(){return D(this,function(a){return[2,t-e]})})},o.maxComparatorNumber=function(t,e){return v(this,void 0,void 0,function(){return D(this,function(a){return[2,e-t]})})},o.defaultIsEqual=function(t,e){return v(this,void 0,void 0,function(){return D(this,function(a){return[2,t===e]})})},o.print=function(t){function e(h){var m=o.getParentIndexOf(h);return Math.floor(Math.log2(m+1))}function a(h,m){for(var f="";m>0;--m)f+=h;return f}for(var i=0,s=[],r=e(t.length-1)+2,n=0;i<t.length;){var c=e(i)+1;i===0&&(c=0);var l=String(t.get(i));l.length>n&&(n=l.length),s[c]=s[c]||[],s[c].push(l),i+=1}return s.map(function(h,m){var f=Math.pow(2,r-m)-1;return a(" ",Math.floor(f/2)*n)+h.map(function(p){var y=(n-p.length)/2;return a(" ",Math.ceil(y))+p+a(" ",Math.floor(y))}).join(a(" ",f*n))}).join(`\n`)},o.heapify=function(t,e){return v(this,void 0,void 0,function(){var a;return D(this,function(i){switch(i.label){case 0:return a=new o(e),a.heapArray=t,[4,a.init()];case 1:return i.sent(),[2,a]}})})},o.heappop=function(t,e){var a=new o(e);return a.heapArray=t,a.pop()},o.heappush=function(t,e,a){return v(this,void 0,void 0,function(){var i;return D(this,function(s){switch(s.label){case 0:return i=new o(a),i.heapArray=t,[4,i.push(e)];case 1:return s.sent(),[2]}})})},o.heappushpop=function(t,e,a){var i=new o(a);return i.heapArray=t,i.pushpop(e)},o.heapreplace=function(t,e,a){var i=new o(a);return i.heapArray=t,i.replace(e)},o.heaptop=function(t,e,a){e===void 0&&(e=1);var i=new o(a);return i.heapArray=t,i.top(e)},o.heapbottom=function(t,e,a){e===void 0&&(e=1);var i=new o(a);return i.heapArray=t,i.bottom(e)},o.nlargest=function(t,e,a){return v(this,void 0,void 0,function(){var i;return D(this,function(s){switch(s.label){case 0:return i=new o(a),i.heapArray=H([],E(e),!1),[4,i.init()];case 1:return s.sent(),[2,i.top(t)]}})})},o.nsmallest=function(t,e,a){return v(this,void 0,void 0,function(){var i;return D(this,function(s){switch(s.label){case 0:return i=new o(a),i.heapArray=H([],E(e),!1),[4,i.init()];case 1:return s.sent(),[2,i.bottom(t)]}})})},o.prototype.add=function(t){return v(this,void 0,void 0,function(){return D(this,function(e){switch(e.label){case 0:return[4,this._sortNodeUp(this.heapArray.push(t)-1)];case 1:return e.sent(),this._applyLimit(),[2,!0]}})})},o.prototype.addAll=function(t){return v(this,void 0,void 0,function(){var e,a,i;return D(this,function(s){switch(s.label){case 0:e=this.length,(i=this.heapArray).push.apply(i,H([],E(t),!1)),a=this.length,s.label=1;case 1:return e<a?[4,this._sortNodeUp(e)]:[3,4];case 2:s.sent(),s.label=3;case 3:return++e,[3,1];case 4:return this._applyLimit(),[2,!0]}})})},o.prototype.bottom=function(){return v(this,arguments,void 0,function(t){return t===void 0&&(t=1),D(this,function(e){return this.heapArray.length===0||t<=0?[2,[]]:this.heapArray.length===1?[2,[this.heapArray[0]]]:t>=this.heapArray.length?[2,H([],E(this.heapArray),!1)]:[2,this._bottomN_push(~~t)]})})},o.prototype.check=function(){return v(this,void 0,void 0,function(){var t,e,a,i,s,r,n,c,l;return D(this,function(h){switch(h.label){case 0:t=0,h.label=1;case 1:if(!(t<this.heapArray.length))return[3,10];e=this.heapArray[t],a=this.getChildrenOf(t),h.label=2;case 2:h.trys.push([2,7,8,9]),i=(c=void 0,Me(a)),s=i.next(),h.label=3;case 3:return s.done?[3,6]:(r=s.value,[4,this.compare(e,r)]);case 4:if(h.sent()>0)return[2,e];h.label=5;case 5:return s=i.next(),[3,3];case 6:return[3,9];case 7:return n=h.sent(),c={error:n},[3,9];case 8:try{s&&!s.done&&(l=i.return)&&l.call(i)}finally{if(c)throw c.error}return[7];case 9:return++t,[3,1];case 10:return[2]}})})},o.prototype.clear=function(){this.heapArray=[]},o.prototype.clone=function(){var t=new o(this.comparator());return t.heapArray=this.toArray(),t._limit=this._limit,t},o.prototype.comparator=function(){return this.compare},o.prototype.contains=function(t){return v(this,arguments,void 0,function(e,a){var i,s,r,n,c,l;return a===void 0&&(a=o.defaultIsEqual),D(this,function(h){switch(h.label){case 0:h.trys.push([0,5,6,7]),i=Me(this.heapArray),s=i.next(),h.label=1;case 1:return s.done?[3,4]:(r=s.value,[4,a(r,e)]);case 2:if(h.sent())return[2,!0];h.label=3;case 3:return s=i.next(),[3,1];case 4:return[3,7];case 5:return n=h.sent(),c={error:n},[3,7];case 6:try{s&&!s.done&&(l=i.return)&&l.call(i)}finally{if(c)throw c.error}return[7];case 7:return[2,!1]}})})},o.prototype.init=function(t){return v(this,void 0,void 0,function(){var e;return D(this,function(a){switch(a.label){case 0:t&&(this.heapArray=H([],E(t),!1)),e=Math.floor(this.heapArray.length),a.label=1;case 1:return e>=0?[4,this._sortNodeDown(e)]:[3,4];case 2:a.sent(),a.label=3;case 3:return--e,[3,1];case 4:return this._applyLimit(),[2]}})})},o.prototype.isEmpty=function(){return this.length===0},o.prototype.leafs=function(){if(this.heapArray.length===0)return[];var t=o.getParentIndexOf(this.heapArray.length-1);return this.heapArray.slice(t+1)},Object.defineProperty(o.prototype,"length",{get:function(){return this.heapArray.length},enumerable:!1,configurable:!0}),Object.defineProperty(o.prototype,"limit",{get:function(){return this._limit},set:function(t){this._limit=~~t,this._applyLimit()},enumerable:!1,configurable:!0}),o.prototype.peek=function(){return this.heapArray[0]},o.prototype.pop=function(){return v(this,void 0,void 0,function(){var t;return D(this,function(e){return t=this.heapArray.pop(),this.length>0&&t!==void 0?[2,this.replace(t)]:[2,t]})})},o.prototype.push=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];return v(this,void 0,void 0,function(){return D(this,function(a){return t.length<1?[2,!1]:t.length===1?[2,this.add(t[0])]:[2,this.addAll(t)]})})},o.prototype.pushpop=function(t){return v(this,void 0,void 0,function(){var e;return D(this,function(a){switch(a.label){case 0:return[4,this.compare(this.heapArray[0],t)];case 1:return a.sent()<0?(e=E([this.heapArray[0],t],2),t=e[0],this.heapArray[0]=e[1],[4,this._sortNodeDown(0)]):[3,3];case 2:a.sent(),a.label=3;case 3:return[2,t]}})})},o.prototype.remove=function(t){return v(this,arguments,void 0,function(e,a){var i,s,r,n=this;return a===void 0&&(a=o.defaultIsEqual),D(this,function(c){switch(c.label){case 0:return this.heapArray.length?e!==void 0?[3,2]:[4,this.pop()]:[2,!1];case 1:return c.sent(),[2,!0];case 2:i=[0],c.label=3;case 3:return i.length?(s=i.shift(),[4,a(this.heapArray[s],e)]):[3,13];case 4:return c.sent()?s!==0?[3,6]:[4,this.pop()]:[3,11];case 5:return c.sent(),[3,10];case 6:return s!==this.heapArray.length-1?[3,7]:(this.heapArray.pop(),[3,10]);case 7:return this.heapArray.splice(s,1,this.heapArray.pop()),[4,this._sortNodeUp(s)];case 8:return c.sent(),[4,this._sortNodeDown(s)];case 9:c.sent(),c.label=10;case 10:return[2,!0];case 11:r=o.getChildrenIndexOf(s).filter(function(l){return l<n.heapArray.length}),i.push.apply(i,H([],E(r),!1)),c.label=12;case 12:return[3,3];case 13:return[2,!1]}})})},o.prototype.replace=function(t){return v(this,void 0,void 0,function(){var e;return D(this,function(a){switch(a.label){case 0:return e=this.heapArray[0],this.heapArray[0]=t,[4,this._sortNodeDown(0)];case 1:return a.sent(),[2,e]}})})},o.prototype.size=function(){return this.length},o.prototype.top=function(){return v(this,arguments,void 0,function(t){return t===void 0&&(t=1),D(this,function(e){return this.heapArray.length===0||t<=0?[2,[]]:this.heapArray.length===1||t===1?[2,[this.heapArray[0]]]:t>=this.heapArray.length?[2,H([],E(this.heapArray),!1)]:[2,this._topN_push(~~t)]})})},o.prototype.toArray=function(){return H([],E(this.heapArray),!1)},o.prototype.toString=function(){return this.heapArray.toString()},o.prototype.get=function(t){return this.heapArray[t]},o.prototype.getChildrenOf=function(t){var e=this;return o.getChildrenIndexOf(t).map(function(a){return e.heapArray[a]}).filter(function(a){return a!==void 0})},o.prototype.getParentOf=function(t){var e=o.getParentIndexOf(t);return this.heapArray[e]},o.prototype[Symbol.iterator]=function(){return D(this,function(t){switch(t.label){case 0:return this.length?[4,this.pop()]:[3,2];case 1:return t.sent(),[3,0];case 2:return[2]}})},o.prototype.iterator=function(){return this},o.prototype._applyLimit=function(){if(this._limit&&this._limit<this.heapArray.length)for(var t=this.heapArray.length-this._limit;t;)this.heapArray.pop(),--t},o.prototype._bottomN_push=function(t){return v(this,void 0,void 0,function(){var e,a,i,s,n,r,n;return D(this,function(c){switch(c.label){case 0:return e=new o(this.compare),e.limit=t,e.heapArray=this.heapArray.slice(-t),[4,e.init()];case 1:for(c.sent(),a=this.heapArray.length-1-t,i=o.getParentIndexOf(a),s=[],n=a;n>i;--n)s.push(n);r=this.heapArray,c.label=2;case 2:return s.length?(n=s.shift(),[4,this.compare(r[n],e.peek())]):[3,6];case 3:return c.sent()>0?[4,e.replace(r[n])]:[3,5];case 4:c.sent(),n%2&&s.push(o.getParentIndexOf(n)),c.label=5;case 5:return[3,2];case 6:return[2,e.toArray()]}})})},o.prototype._moveNode=function(t,e){var a;a=E([this.heapArray[e],this.heapArray[t]],2),this.heapArray[t]=a[0],this.heapArray[e]=a[1]},o.prototype._sortNodeDown=function(t){return v(this,void 0,void 0,function(){var e,a,i,s,r,n;return D(this,function(c){switch(c.label){case 0:e=this.heapArray.length,c.label=1;case 1:return a=2*t+1,i=a+1,s=t,r=a<e,r?[4,this.compare(this.heapArray[a],this.heapArray[s])]:[3,3];case 2:r=c.sent()<0,c.label=3;case 3:return r&&(s=a),n=i<e,n?[4,this.compare(this.heapArray[i],this.heapArray[s])]:[3,5];case 4:n=c.sent()<0,c.label=5;case 5:if(n&&(s=i),s===t)return[3,7];this._moveNode(t,s),t=s,c.label=6;case 6:return[3,1];case 7:return[2]}})})},o.prototype._sortNodeUp=function(t){return v(this,void 0,void 0,function(){var e;return D(this,function(a){switch(a.label){case 0:return t>0?(e=o.getParentIndexOf(t),[4,this.compare(this.heapArray[t],this.heapArray[e])]):[3,2];case 1:if(a.sent()<0)this._moveNode(t,e),t=e;else return[3,2];return[3,0];case 2:return[2]}})})},o.prototype._topN_push=function(t){return v(this,void 0,void 0,function(){var e,a,i,s;return D(this,function(r){switch(r.label){case 0:e=new o(this._invertedCompare),e.limit=t,a=[0],i=this.heapArray,r.label=1;case 1:return a.length?(s=a.shift(),s<i.length?e.length<t?[4,e.push(i[s])]:[3,3]:[3,6]):[3,7];case 2:return r.sent(),a.push.apply(a,H([],E(o.getChildrenIndexOf(s)),!1)),[3,6];case 3:return[4,this.compare(i[s],e.peek())];case 4:return r.sent()<0?[4,e.replace(i[s])]:[3,6];case 5:r.sent(),a.push.apply(a,H([],E(o.getChildrenIndexOf(s)),!1)),r.label=6;case 6:return[3,1];case 7:return[2,e.toArray()]}})})},o.prototype._topN_fill=function(t){return v(this,void 0,void 0,function(){var e,a,i,s,r,r;return D(this,function(n){switch(n.label){case 0:return e=this.heapArray,a=new o(this._invertedCompare),a.limit=t,a.heapArray=e.slice(0,t),[4,a.init()];case 1:for(n.sent(),i=o.getParentIndexOf(t-1)+1,s=[],r=i;r<t;++r)s.push.apply(s,H([],E(o.getChildrenIndexOf(r).filter(function(c){return c<e.length})),!1));(t-1)%2&&s.push(t),n.label=2;case 2:return s.length?(r=s.shift(),r<e.length?[4,this.compare(e[r],a.peek())]:[3,5]):[3,6];case 3:return n.sent()<0?[4,a.replace(e[r])]:[3,5];case 4:n.sent(),s.push.apply(s,H([],E(o.getChildrenIndexOf(r)),!1)),n.label=5;case 5:return[3,2];case 6:return[2,a.toArray()]}})})},o.prototype._topN_heap=function(t){return v(this,void 0,void 0,function(){var e,a,i,s,r;return D(this,function(n){switch(n.label){case 0:e=this.clone(),a=[],i=0,n.label=1;case 1:return i<t?(r=(s=a).push,[4,e.pop()]):[3,4];case 2:r.apply(s,[n.sent()]),n.label=3;case 3:return++i,[3,1];case 4:return[2,a]}})})},o.prototype._topIdxOf=function(t){return v(this,void 0,void 0,function(){var e,a,i,s;return D(this,function(r){switch(r.label){case 0:if(!t.length)return[2,-1];e=0,a=t[e],i=1,r.label=1;case 1:return i<t.length?[4,this.compare(t[i],a)]:[3,4];case 2:s=r.sent(),s<0&&(e=i,a=t[i]),r.label=3;case 3:return++i,[3,1];case 4:return[2,e]}})})},o.prototype._topOf=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];return v(this,void 0,void 0,function(){var a;return D(this,function(i){switch(i.label){case 0:return a=new o(this.compare),[4,a.init(t)];case 1:return i.sent(),[2,a.peek()]}})})},o})(),sa=function(o,t){var e={label:0,sent:function(){if(s[0]&1)throw s[1];return s[1]},trys:[],ops:[]},a,i,s,r=Object.create((typeof Iterator=="function"?Iterator:Object).prototype);return r.next=n(0),r.throw=n(1),r.return=n(2),typeof Symbol=="function"&&(r[Symbol.iterator]=function(){return this}),r;function n(l){return function(h){return c([l,h])}}function c(l){if(a)throw new TypeError("Generator is already executing.");for(;r&&(r=0,l[0]&&(e=0)),e;)try{if(a=1,i&&(s=l[0]&2?i.return:l[0]?i.throw||((s=i.return)&&s.call(i),0):i.next)&&!(s=s.call(i,l[1])).done)return s;switch(i=0,s&&(l=[l[0]&2,s.value]),l[0]){case 0:case 1:s=l;break;case 4:return e.label++,{value:l[1],done:!1};case 5:e.label++,i=l[1],l=[0];continue;case 7:l=e.ops.pop(),e.trys.pop();continue;default:if(s=e.trys,!(s=s.length>0&&s[s.length-1])&&(l[0]===6||l[0]===2)){e=0;continue}if(l[0]===3&&(!s||l[1]>s[0]&&l[1]<s[3])){e.label=l[1];break}if(l[0]===6&&e.label<s[1]){e.label=s[1],s=l;break}if(s&&e.label<s[2]){e.label=s[2],e.ops.push(l);break}s[2]&&e.ops.pop(),e.trys.pop();continue}l=t.call(o,e)}catch(h){l=[6,h],i=0}finally{a=s=0}if(l[0]&5)throw l[1];return{value:l[0]?l[1]:void 0,done:!0}}},_=function(o,t){var e=typeof Symbol=="function"&&o[Symbol.iterator];if(!e)return o;var a=e.call(o),i,s=[],r;try{for(;(t===void 0||t-- >0)&&!(i=a.next()).done;)s.push(i.value)}catch(n){r={error:n}}finally{try{i&&!i.done&&(e=a.return)&&e.call(a)}finally{if(r)throw r.error}}return s},w=function(o,t,e){if(e||arguments.length===2)for(var a=0,i=t.length,s;a<i;a++)(s||!(a in t))&&(s||(s=Array.prototype.slice.call(t,0,a)),s[a]=t[a]);return o.concat(s||Array.prototype.slice.call(t))};var Vt=(function(){function o(t){t===void 0&&(t=o.minComparator);var e=this;this.compare=t,this.heapArray=[],this._limit=0,this.offer=this.add,this.element=this.peek,this.poll=this.pop,this.removeAll=this.clear,this._invertedCompare=function(a,i){return-1*e.compare(a,i)}}return o.getChildrenIndexOf=function(t){return[t*2+1,t*2+2]},o.getParentIndexOf=function(t){if(t<=0)return-1;var e=t%2?1:2;return Math.floor((t-e)/2)},o.getSiblingIndexOf=function(t){if(t<=0)return-1;var e=t%2?1:-1;return t+e},o.minComparator=function(t,e){return t>e?1:t<e?-1:0},o.maxComparator=function(t,e){return e>t?1:e<t?-1:0},o.minComparatorNumber=function(t,e){return t-e},o.maxComparatorNumber=function(t,e){return e-t},o.defaultIsEqual=function(t,e){return t===e},o.print=function(t){function e(h){var m=o.getParentIndexOf(h);return Math.floor(Math.log2(m+1))}function a(h,m){for(var f="";m>0;--m)f+=h;return f}for(var i=0,s=[],r=e(t.length-1)+2,n=0;i<t.length;){var c=e(i)+1;i===0&&(c=0);var l=String(t.get(i));l.length>n&&(n=l.length),s[c]=s[c]||[],s[c].push(l),i+=1}return s.map(function(h,m){var f=Math.pow(2,r-m)-1;return a(" ",Math.floor(f/2)*n)+h.map(function(p){var y=(n-p.length)/2;return a(" ",Math.ceil(y))+p+a(" ",Math.floor(y))}).join(a(" ",f*n))}).join(`\n`)},o.heapify=function(t,e){var a=new o(e);return a.heapArray=t,a.init(),a},o.heappop=function(t,e){var a=new o(e);return a.heapArray=t,a.pop()},o.heappush=function(t,e,a){var i=new o(a);i.heapArray=t,i.push(e)},o.heappushpop=function(t,e,a){var i=new o(a);return i.heapArray=t,i.pushpop(e)},o.heapreplace=function(t,e,a){var i=new o(a);return i.heapArray=t,i.replace(e)},o.heaptop=function(t,e,a){e===void 0&&(e=1);var i=new o(a);return i.heapArray=t,i.top(e)},o.heapbottom=function(t,e,a){e===void 0&&(e=1);var i=new o(a);return i.heapArray=t,i.bottom(e)},o.nlargest=function(t,e,a){var i=new o(a);return i.heapArray=w([],_(e),!1),i.init(),i.top(t)},o.nsmallest=function(t,e,a){var i=new o(a);return i.heapArray=w([],_(e),!1),i.init(),i.bottom(t)},o.prototype.add=function(t){return this._sortNodeUp(this.heapArray.push(t)-1),this._applyLimit(),!0},o.prototype.addAll=function(t){var e,a=this.length;(e=this.heapArray).push.apply(e,w([],_(t),!1));for(var i=this.length;a<i;++a)this._sortNodeUp(a);return this._applyLimit(),!0},o.prototype.bottom=function(t){return t===void 0&&(t=1),this.heapArray.length===0||t<=0?[]:this.heapArray.length===1?[this.heapArray[0]]:t>=this.heapArray.length?w([],_(this.heapArray),!1):this._bottomN_push(~~t)},o.prototype.check=function(){var t=this;return this.heapArray.find(function(e,a){return!!t.getChildrenOf(a).find(function(i){return t.compare(e,i)>0})})},o.prototype.clear=function(){this.heapArray=[]},o.prototype.clone=function(){var t=new o(this.comparator());return t.heapArray=this.toArray(),t._limit=this._limit,t},o.prototype.comparator=function(){return this.compare},o.prototype.contains=function(t,e){return e===void 0&&(e=o.defaultIsEqual),this.indexOf(t,e)!==-1},o.prototype.init=function(t){t&&(this.heapArray=w([],_(t),!1));for(var e=Math.floor(this.heapArray.length);e>=0;--e)this._sortNodeDown(e);this._applyLimit()},o.prototype.isEmpty=function(){return this.length===0},o.prototype.indexOf=function(t,e){if(e===void 0&&(e=o.defaultIsEqual),this.heapArray.length===0)return-1;for(var a=[],i=0;i<this.heapArray.length;){var s=this.heapArray[i];if(e(s,t))return i;this.compare(s,t)<=0&&a.push.apply(a,w([],_(o.getChildrenIndexOf(i)),!1)),i=a.shift()||this.heapArray.length}return-1},o.prototype.indexOfEvery=function(t,e){if(e===void 0&&(e=o.defaultIsEqual),this.heapArray.length===0)return[];for(var a=[],i=[],s=0;s<this.heapArray.length;){var r=this.heapArray[s];e(r,t)?(i.push(s),a.push.apply(a,w([],_(o.getChildrenIndexOf(s)),!1))):this.compare(r,t)<=0&&a.push.apply(a,w([],_(o.getChildrenIndexOf(s)),!1)),s=a.shift()||this.heapArray.length}return i},o.prototype.leafs=function(){if(this.heapArray.length===0)return[];var t=o.getParentIndexOf(this.heapArray.length-1);return this.heapArray.slice(t+1)},Object.defineProperty(o.prototype,"length",{get:function(){return this.heapArray.length},enumerable:!1,configurable:!0}),Object.defineProperty(o.prototype,"limit",{get:function(){return this._limit},set:function(t){t<0||isNaN(t)?this._limit=0:this._limit=~~t,this._applyLimit()},enumerable:!1,configurable:!0}),o.prototype.setLimit=function(t){return this.limit=t,t<0||isNaN(t)?NaN:this._limit},o.prototype.peek=function(){return this.heapArray[0]},o.prototype.pop=function(){var t=this.heapArray.pop();return this.length>0&&t!==void 0?this.replace(t):t},o.prototype.push=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];return t.length<1?!1:t.length===1?this.add(t[0]):this.addAll(t)},o.prototype.pushpop=function(t){var e;return this.compare(this.heapArray[0],t)<0&&(e=_([this.heapArray[0],t],2),t=e[0],this.heapArray[0]=e[1],this._sortNodeDown(0)),t},o.prototype.remove=function(t,e){var a=this;if(e===void 0&&(e=o.defaultIsEqual),!this.heapArray.length)return!1;if(t===void 0)return this.pop(),!0;for(var i=[0];i.length;){var s=i.shift();if(e(this.heapArray[s],t))return s===0?this.pop():s===this.heapArray.length-1?this.heapArray.pop():(this.heapArray.splice(s,1,this.heapArray.pop()),this._sortNodeUp(s),this._sortNodeDown(s)),!0;if(this.compare(this.heapArray[s],t)<=0){var r=o.getChildrenIndexOf(s).filter(function(n){return n<a.heapArray.length});i.push.apply(i,w([],_(r),!1))}}return!1},o.prototype.replace=function(t){var e=this.heapArray[0];return this.heapArray[0]=t,this._sortNodeDown(0),e},o.prototype.size=function(){return this.length},o.prototype.top=function(t){return t===void 0&&(t=1),this.heapArray.length===0||t<=0?[]:this.heapArray.length===1||t===1?[this.heapArray[0]]:t>=this.heapArray.length?w([],_(this.heapArray),!1):this._topN_push(~~t)},o.prototype.toArray=function(){return w([],_(this.heapArray),!1)},o.prototype.toString=function(){return this.heapArray.toString()},o.prototype.get=function(t){return this.heapArray[t]},o.prototype.getChildrenOf=function(t){var e=this;return o.getChildrenIndexOf(t).map(function(a){return e.heapArray[a]}).filter(function(a){return a!==void 0})},o.prototype.getParentOf=function(t){var e=o.getParentIndexOf(t);return this.heapArray[e]},o.prototype[Symbol.iterator]=function(){return sa(this,function(t){switch(t.label){case 0:return this.length?[4,this.pop()]:[3,2];case 1:return t.sent(),[3,0];case 2:return[2]}})},o.prototype.iterator=function(){return this.toArray()},o.prototype._applyLimit=function(){if(this._limit>0&&this._limit<this.heapArray.length)for(var t=this.heapArray.length-this._limit;t;)this.heapArray.pop(),--t},o.prototype._bottomN_push=function(t){var e=new o(this.compare);e.limit=t,e.heapArray=this.heapArray.slice(-t),e.init();for(var a=this.heapArray.length-1-t,i=o.getParentIndexOf(a),s=[],r=a;r>i;--r)s.push(r);for(var n=this.heapArray;s.length;){var r=s.shift();this.compare(n[r],e.peek())>0&&(e.replace(n[r]),r%2&&s.push(o.getParentIndexOf(r)))}return e.toArray()},o.prototype._moveNode=function(t,e){var a;a=_([this.heapArray[e],this.heapArray[t]],2),this.heapArray[t]=a[0],this.heapArray[e]=a[1]},o.prototype._sortNodeDown=function(t){for(var e=this.heapArray.length;;){var a=2*t+1,i=a+1,s=t;if(a<e&&this.compare(this.heapArray[a],this.heapArray[s])<0&&(s=a),i<e&&this.compare(this.heapArray[i],this.heapArray[s])<0&&(s=i),s===t)break;this._moveNode(t,s),t=s}},o.prototype._sortNodeUp=function(t){for(;t>0;){var e=o.getParentIndexOf(t);if(this.compare(this.heapArray[t],this.heapArray[e])<0)this._moveNode(t,e),t=e;else break}},o.prototype._topN_push=function(t){var e=new o(this._invertedCompare);e.limit=t;for(var a=[0],i=this.heapArray;a.length;){var s=a.shift();s<i.length&&(e.length<t?(e.push(i[s]),a.push.apply(a,w([],_(o.getChildrenIndexOf(s)),!1))):this.compare(i[s],e.peek())<0&&(e.replace(i[s]),a.push.apply(a,w([],_(o.getChildrenIndexOf(s)),!1))))}return e.toArray()},o.prototype._topN_fill=function(t){var e=this.heapArray,a=new o(this._invertedCompare);a.limit=t,a.heapArray=e.slice(0,t),a.init();for(var i=o.getParentIndexOf(t-1)+1,s=[],r=i;r<t;++r)s.push.apply(s,w([],_(o.getChildrenIndexOf(r).filter(function(n){return n<e.length})),!1));for((t-1)%2&&s.push(t);s.length;){var r=s.shift();r<e.length&&this.compare(e[r],a.peek())<0&&(a.replace(e[r]),s.push.apply(s,w([],_(o.getChildrenIndexOf(r)),!1)))}return a.toArray()},o.prototype._topN_heap=function(t){for(var e=this.clone(),a=[],i=0;i<t;++i)a.push(e.pop());return a},o.prototype._topIdxOf=function(t){if(!t.length)return-1;for(var e=0,a=t[e],i=1;i<t.length;++i){var s=this.compare(t[i],a);s<0&&(e=i,a=t[i])}return e},o.prototype._topOf=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];var a=new o(this.compare);return a.init(t),a.peek()},o})();var Zt=class{constructor(){this.minHeap=new Vt((t,e)=>t.time-e.time)}addEvent(t){this.minHeap.push(t)}getNextEvent(){return this.minHeap.pop()}containsEventOfType(t){return this.minHeap.toArray().some(a=>a.type==t)}containsEventOfTypeAndHrid(t,e){return this.minHeap.toArray().some(i=>i.type==t&&i.hrid==e)}clear(){this.minHeap=new Vt((t,e)=>t.time-e.time)}clearEventsForUnit(t){this.clearMatching(e=>e.source==t||e.target==t)}clearEventsOfType(t){this.clearMatching(e=>e.type==t)}clearMatching(t){let e=!1,a=this.minHeap.toArray();for(let i of a)t(i)&&(this.minHeap.remove(i),e=!0);return e}getMatching(t){let e=this.minHeap.toArray();for(let a of e)if(t(a))return a;return null}},Ce=Zt;var St=class St extends g{constructor(t,e){super(St.type,t),this.hrid=e}};u(St,"type","playerRespawn");var Yt=St,rt=Yt;var _t=class _t extends g{constructor(t){super(_t.type,t)}};u(_t,"type","regenTick");var $t=_t,nt=$t;var At=class At extends g{constructor(t,e){super(At.type,t),this.source=e}};u(At,"type","stunExpiration");var Jt=At,ot=Jt;var wt=class wt extends g{constructor(t,e){super(wt.type,t),this.source=e}};u(wt,"type","blindExpiration");var Xt=wt,lt=Xt;var Et=class Et extends g{constructor(t,e){super(Et.type,t),this.source=e}};u(Et,"type","silenceExpiration");var te=Et,ct=te;var V=class V extends g{constructor(t,e,a){super(V.type,t),this.curseAmount=Math.min(e+1,V.maxCurseStacks),this.source=a}};u(V,"type","curseExpiration"),u(V,"maxCurseStacks",5);var ee=V,P=ee;var Z=class Z extends g{constructor(t,e,a){super(Z.type,t),this.weakenAmount=Math.min(e+1,Z.maxWeakenStacks),this.source=a}};u(Z,"type","weakenExpiration"),u(Z,"maxWeakenStacks",5);var ae=Z,N=ae;var Rt=class Rt extends g{constructor(t,e,a){super(Rt.type,t),this.furyAmount=e,this.source=a}};u(Rt,"type","furyExpiration");var ie=Rt,q=ie;var xt=class xt extends g{constructor(t,e){super(xt.type,t),this.encounterTime=e}};u(xt,"type","enrageTick");var se=xt,Y=se;var Oe=S("combatStyleDetailMap");var re=class{constructor(t,e,a){this.deaths={},this.experienceGained={},this.encounters=0,this.attacks={},this.consumablesUsed={},this.hitpointsGained={},this.manapointsGained={},this.debuffOnLevelGap={},this.dropRateMultiplier={},this.rareFindMultiplier={},this.combatDropQuantity={},this.playerRanOutOfMana={player1:!1,player2:!1,player3:!1,player4:!1,player5:!1},this.playerRanOutOfManaTime={},this.manaUsed={},this.timeSpentAlive=[],this.bossSpawns=[],this.hitpointsSpent={},this.zoneName=t?.hrid,this.difficultyTier=t?.difficultyTier,this.labyrinthName=e?.monsterHrid,this.roomLevel=e?.roomLevel,this.isDungeon=!1,this.isLabyrinth=!!e,this.dungeonsCompleted=0,this.dungeonsFailed=0,this.maxWaveReached=0,this.numberOfPlayers=a,this.maxEnrageStack=0,this.minDungenonTime=0,this.maxDungenonTime=0,this.lastDungeonFinishTime=0,this.lastEncounterFinishTime=0,this.labyAttemptCount=0,this.wipeEvents=[],this.timeSeriesData={timestamps:[],players:{}}}addWipeEvent(t,e,a){this.wipeEvents.push({simulationTime:e,logs:t,wave:a,timestamp:new Date().toISOString()})}addDeath(t){this.deaths[t.hrid]||(this.deaths[t.hrid]=0),this.deaths[t.hrid]+=1}updateTimeSpentAlive(t,e,a){let i=this.timeSpentAlive.findIndex(s=>s.name===t);if(e)i!==-1?(this.timeSpentAlive[i].alive=!0,this.timeSpentAlive[i].spawnedAt=a):this.timeSpentAlive.push({name:t,timeSpentAlive:0,spawnedAt:a,alive:!0,count:0});else{let s=a-this.timeSpentAlive[i].spawnedAt;this.timeSpentAlive[i].alive=!1,this.timeSpentAlive[i].timeSpentAlive+=s,this.timeSpentAlive[i].count+=1}}updateDungenonFinish(t,e){let a=this.timeSpentAlive.findIndex(s=>s.name===t);if(a==-1)return;let i=e-this.timeSpentAlive[a].spawnedAt;(this.minDungenonTime==0||this.minDungenonTime>i)&&(this.minDungenonTime=i),this.maxDungenonTime<i&&(this.maxDungenonTime=i)}addExperienceGain(t,e){if(!t.isPlayer)return;this.experienceGained[t.hrid]||(this.experienceGained[t.hrid]={stamina:0,intelligence:0,attack:0,melee:0,defense:0,ranged:0,magic:0});let a={stamina:0,intelligence:0,attack:0,melee:0,defense:0,ranged:0,magic:0},i=t.combatDetails.combatStats.primaryTraining;a[i.split("/")[2]]=.3;let s=Oe[t.combatDetails.combatStats.combatStyleHrid].skillExpMap,r=Object.keys(s).length,n=t.combatDetails.combatStats.focusTraining;n&&s[n]?a[n.split("/")[2]]+=.7:Object.keys(s).forEach(c=>{a[c.split("/")[2]]+=.7/r});for(let[c,l]of Object.entries(a)){if(l<=0)continue;let h=l*(1+t.combatDetails.combatStats[c+"Experience"]);this.experienceGained[t.hrid][c]+=e*(1+t.combatDetails.combatStats.combatExperience)*h*(1+t.debuffOnLevelGap)}}addEncounterEnd(){this.encounters++}addAttack(t,e,a,i){this.attacks[t.hrid]||(this.attacks[t.hrid]={}),this.attacks[t.hrid][e.hrid]||(this.attacks[t.hrid][e.hrid]={}),this.attacks[t.hrid][e.hrid][a]||(this.attacks[t.hrid][e.hrid][a]={}),this.attacks[t.hrid][e.hrid][a][i]||(this.attacks[t.hrid][e.hrid][a][i]=0),this.attacks[t.hrid][e.hrid][a][i]+=1}addConsumableUse(t,e){this.consumablesUsed[t.hrid]||(this.consumablesUsed[t.hrid]={}),this.consumablesUsed[t.hrid][e.hrid]||(this.consumablesUsed[t.hrid][e.hrid]=0),this.consumablesUsed[t.hrid][e.hrid]+=1}addHitpointsGained(t,e,a){this.hitpointsGained[t.hrid]||(this.hitpointsGained[t.hrid]={}),this.hitpointsGained[t.hrid][e]||(this.hitpointsGained[t.hrid][e]=0),this.hitpointsGained[t.hrid][e]+=a}addManapointsGained(t,e,a){this.manapointsGained[t.hrid]||(this.manapointsGained[t.hrid]={}),this.manapointsGained[t.hrid][e]||(this.manapointsGained[t.hrid][e]=0),this.manapointsGained[t.hrid][e]+=a}setDropRateMultipliers(t){this.dropRateMultiplier[t.hrid]||(this.dropRateMultiplier[t.hrid]={}),this.dropRateMultiplier[t.hrid]=1+t.combatDetails.combatStats.combatDropRate,this.rareFindMultiplier[t.hrid]||(this.rareFindMultiplier[t.hrid]={}),this.rareFindMultiplier[t.hrid]=1+t.combatDetails.combatStats.combatRareFind,this.combatDropQuantity[t.hrid]||(this.combatDropQuantity[t.hrid]={}),this.combatDropQuantity[t.hrid]=t.combatDetails.combatStats.combatDropQuantity,this.debuffOnLevelGap[t.hrid]||(this.debuffOnLevelGap[t.hrid]={}),this.debuffOnLevelGap[t.hrid]=t.debuffOnLevelGap}setManaUsed(t){this.manaUsed[t.hrid]={};for(let[e,a]of t.abilityManaCosts.entries())this.manaUsed[t.hrid][e]=a}addHitpointsSpent(t,e,a){this.hitpointsSpent[t.hrid]||(this.hitpointsSpent[t.hrid]={}),this.hitpointsSpent[t.hrid][e]||(this.hitpointsSpent[t.hrid][e]=0),this.hitpointsSpent[t.hrid][e]+=a}addRanOutOfManaCount(t,e,a){e&&(this.playerRanOutOfMana[t.hrid]=!0),this.playerRanOutOfManaTime[t.hrid]||(this.playerRanOutOfManaTime[t.hrid]={isOutOfMana:!1,startTimeForOutOfMana:0,totalTimeForOutOfMana:0}),e?this.playerRanOutOfManaTime[t.hrid].isOutOfMana||(this.playerRanOutOfManaTime[t.hrid].isOutOfMana=!0,this.playerRanOutOfManaTime[t.hrid].startTimeForOutOfMana=a):this.playerRanOutOfManaTime[t.hrid].isOutOfMana&&(this.playerRanOutOfManaTime[t.hrid].isOutOfMana=!1,this.playerRanOutOfManaTime[t.hrid].totalTimeForOutOfMana+=a-this.playerRanOutOfManaTime[t.hrid].startTimeForOutOfMana)}addTimeSeriesSnapshot(t,e){this.timeSeriesData.timestamps.push(t),e.forEach(a=>{this.timeSeriesData.players[a.hrid]||(this.timeSeriesData.players[a.hrid]={hp:[],mp:[],maxHp:[],maxMp:[]});let i=this.timeSeriesData.players[a.hrid];i.hp.push(a.combatDetails.currentHitpoints),i.mp.push(a.combatDetails.currentManapoints),i.maxHp.push(a.combatDetails.maxHitpoints),i.maxMp.push(a.combatDetails.maxManapoints)})}},ne=re;var Bt=class Bt extends g{constructor(t,e,a){super(Bt.type,t),this.source=e,this.ability=a}};u(Bt,"type","abilityCastEndEvent");var oe=Bt,M=oe;var Ht=class Ht extends g{constructor(t,e){super(Ht.type,t),this.source=e}};u(Ht,"type","awaitCooldownEvent");var le=Ht,$=le;var ce=class{constructor(t,e=1){u(this,"startTime");this.uniqueHrid=t.uniqueHrid,this.typeHrid=t.typeHrid,this.ratioBoost=t.ratioBoost+(e-1)*t.ratioBoostLevelBonus,this.flatBoost=t.flatBoost+(e-1)*t.flatBoostLevelBonus,this.duration=t.duration,this.multiplierForSkillHrid=t.multiplierForSkillHrid??"",this.multiplierPerSkillLevel=t.multiplierPerSkillLevel??0}},C=ce;var Le=S("abilityDetailMap");var Ie=S("combatTriggerDependencyDetailMap");var he=class o{constructor(t,e,a,i=0){this.dependencyHrid=t,this.conditionHrid=e,this.comparatorHrid=a,this.value=i}static createFromDTO(t){return new o(t.dependencyHrid,t.conditionHrid,t.comparatorHrid,t.value)}isActive(t,e,a,i,s){return Ie[this.dependencyHrid].isSingleTarget?this.isActiveSingleTarget(t,e,s):this.isActiveMultiTarget(a,i,s)}isActiveSingleTarget(t,e,a){let i;switch(this.dependencyHrid){case"/combat_trigger_dependencies/self":i=this.getDependencyValue(t,a);break;case"/combat_trigger_dependencies/targeted_enemy":if(!e)return!1;i=this.getDependencyValue(e,a);break;default:throw new Error("Unknown dependencyHrid in trigger: "+this.dependencyHrid)}return this.compareValue(i)}isActiveMultiTarget(t,e,a){let i;switch(this.dependencyHrid){case"/combat_trigger_dependencies/all_allies":i=t;break;case"/combat_trigger_dependencies/all_enemies":if(!e)return!1;i=e;break;default:throw new Error("Unknown dependencyHrid in trigger: "+this.dependencyHrid)}let s;switch(this.conditionHrid){case"/combat_trigger_conditions/number_of_active_units":s=i.filter(r=>r.combatDetails.currentHitpoints>0).length;break;case"/combat_trigger_conditions/number_of_dead_units":s=i.filter(r=>r.combatDetails.currentHitpoints<=0).length;break;case"/combat_trigger_conditions/lowest_hp_percentage":s=i.filter(r=>r.combatDetails.currentHitpoints>0).reduce((r,n)=>{let c=n.combatDetails.currentHitpoints/n.combatDetails.maxHitpoints;return c<r?c:r},2)*100;break;default:s=i.filter(r=>r.combatDetails.currentHitpoints>0).map(r=>this.getDependencyValue(r,a)).reduce((r,n)=>r+n,0);break}return this.compareValue(s)}getDependencyValue(t,e){switch(this.conditionHrid){case"/combat_trigger_conditions/berserk":case"/combat_trigger_conditions/frenzy":case"/combat_trigger_conditions/precision":case"/combat_trigger_conditions/vampirism":case"/combat_trigger_conditions/attack_coffee":case"/combat_trigger_conditions/defense_coffee":case"/combat_trigger_conditions/lucky_coffee":case"/combat_trigger_conditions/magic_coffee":case"/combat_trigger_conditions/melee_coffee":case"/combat_trigger_conditions/ranged_coffee":case"/combat_trigger_conditions/swiftness_coffee":case"/combat_trigger_conditions/wisdom_coffee":case"/combat_trigger_conditions/ice_spear":case"/combat_trigger_conditions/puncture":case"/combat_trigger_conditions/frost_surge":case"/combat_trigger_conditions/elusiveness":case"/combat_trigger_conditions/channeling_coffee":case"/combat_trigger_conditions/fierce_aura":case"/combat_trigger_conditions/invincible_armor":case"/combat_trigger_conditions/invincible_fire_resistance":case"/combat_trigger_conditions/invincible_nature_resistance":case"/combat_trigger_conditions/invincible_water_resistance":case"/combat_trigger_conditions/provoke":case"/combat_trigger_conditions/taunt":case"/combat_trigger_conditions/crippling_slash":case"/combat_trigger_conditions/mana_spring":case"/combat_trigger_conditions/retribution":case"/combat_trigger_conditions/fracturing_impact":case"/combat_trigger_conditions/maim":case"/combat_trigger_conditions/curse":case"/combat_trigger_conditions/weaken":let a="/buff_uniques";return a+=this.conditionHrid.slice(this.conditionHrid.lastIndexOf("/")),t.combatBuffs[a];case"/combat_trigger_conditions/critical_aura":case"/combat_trigger_conditions/critical_coffee":case"/combat_trigger_conditions/intelligence_coffee":case"/combat_trigger_conditions/stamina_coffee":case"/combat_trigger_conditions/elemental_affinity":case"/combat_trigger_conditions/fury":case"/combat_trigger_conditions/guardian_aura":case"/combat_trigger_conditions/insanity":case"/combat_trigger_conditions/spike_shell":case"/combat_trigger_conditions/toxic_pollen":case"/combat_trigger_conditions/invincible":case"/combat_trigger_conditions/mystic_aura":case"/combat_trigger_conditions/pestilent_shot":case"/combat_trigger_conditions/smoke_burst":case"/combat_trigger_conditions/speed_aura":case"/combat_trigger_conditions/toughness":case"/combat_trigger_conditions/enrage":let i="/buff_uniques";i+=this.conditionHrid.slice(this.conditionHrid.lastIndexOf("/"));let s=Object.keys(t.combatBuffs).filter(r=>r.startsWith(i));return t.combatBuffs[s?.[0]];case"/combat_trigger_conditions/current_hp":return t.combatDetails.currentHitpoints;case"/combat_trigger_conditions/current_mp":return t.combatDetails.currentManapoints;case"/combat_trigger_conditions/missing_hp":return t.combatDetails.maxHitpoints-t.combatDetails.currentHitpoints;case"/combat_trigger_conditions/missing_mp":return t.combatDetails.maxManapoints-t.combatDetails.currentManapoints;case"/combat_trigger_conditions/stun_status":return t.isStunned||t.stunExpireTime==e;case"/combat_trigger_conditions/blind_status":return t.isBlinded||t.blindExpireTime==e;case"/combat_trigger_conditions/silence_status":return t.isSilenced||t.silenceExpireTime==e;default:throw new Error("Unknown conditionHrid in trigger: "+this.conditionHrid)}}compareValue(t){switch(this.comparatorHrid){case"/combat_trigger_comparators/greater_than_equal":return t>=this.value;case"/combat_trigger_comparators/less_than_equal":return t<=this.value;case"/combat_trigger_comparators/is_active":return!!t;case"/combat_trigger_comparators/is_inactive":return!t;default:throw new Error("Unknown comparatorHrid in trigger: "+this.comparatorHrid)}}},J=he;var ra={blaze:{hrid:"/abilities/blaze",name:"Blaze",description:"",isSpecialAbility:!1,manaCost:0,cooldownDuration:0,castDuration:0,abilityEffects:[{targetType:"allEnemies",effectType:"/ability_effect_types/damage",combatStyleHrid:"/combat_styles/magic",damageType:"/damage_types/fire",baseDamageFlat:0,baseDamageFlatLevelBonus:0,baseDamageRatio:.3,baseDamageRatioLevelBonus:0,bonusAccuracyRatio:0,bonusAccuracyRatioLevelBonus:0,damageOverTimeRatio:0,damageOverTimeDuration:0,armorDamageRatio:0,armorDamageRatioLevelBonus:0,hpDrainRatio:0,pierceChance:0,blindChance:0,blindDuration:0,silenceChance:0,silenceDuration:0,stunChance:0,stunDuration:0,spendHpRatio:0,buffs:null}],defaultCombatTriggers:[{dependencyHrid:"/combat_trigger_dependencies/all_enemies",conditionHrid:"/combat_trigger_conditions/number_of_active_units",comparatorHrid:"/combat_trigger_comparators/greater_than_equal",value:1},{dependencyHrid:"/combat_trigger_dependencies/all_enemies",conditionHrid:"/combat_trigger_conditions/current_hp",comparatorHrid:"/combat_trigger_comparators/greater_than_equal",value:1}]},bloom:{hrid:"/abilities/bloom",name:"Bloom",description:"",isSpecialAbility:!1,manaCost:0,cooldownDuration:0,castDuration:0,abilityEffects:[{targetType:"lowestHpAlly",effectType:"/ability_effect_types/heal",combatStyleHrid:"/combat_styles/magic",damageType:"",baseDamageFlat:10,baseDamageFlatLevelBonus:0,baseDamageRatio:.15,baseDamageRatioLevelBonus:0,bonusAccuracyRatio:0,bonusAccuracyRatioLevelBonus:0,damageOverTimeRatio:0,damageOverTimeDuration:0,armorDamageRatio:0,armorDamageRatioLevelBonus:0,hpDrainRatio:0,pierceChance:0,blindChance:0,blindDuration:0,silenceChance:0,silenceDuration:0,stunChance:0,stunDuration:0,spendHpRatio:0,buffs:null}],defaultCombatTriggers:[{dependencyHrid:"/combat_trigger_dependencies/all_allies",conditionHrid:"/combat_trigger_conditions/lowest_hp_percentage",comparatorHrid:"/combat_trigger_comparators/less_than_equal",value:100}]}},me=class o{constructor(t,e=1,a=null){this.hrid=t,this.level=e;let i=Le[t];if(i||(i=ra[t]),!i)throw new Error("No ability found for hrid: "+this.hrid);this.manaCost=i.manaCost,this.cooldownDuration=i.cooldownDuration,this.castDuration=i.castDuration,this.isSpecialAbility=i.isSpecialAbility,this.abilityEffects=[];for(let s of i.abilityEffects){let r={targetType:s.targetType,effectType:s.effectType,combatStyleHrid:s.combatStyleHrid,damageType:s.damageType,damageFlat:s.baseDamageFlat+(this.level-1)*s.baseDamageFlatLevelBonus,damageRatio:s.baseDamageRatio+(this.level-1)*s.baseDamageRatioLevelBonus,bonusAccuracyRatio:s.bonusAccuracyRatio+(this.level-1)*s.bonusAccuracyRatioLevelBonus,damageOverTimeRatio:s.damageOverTimeRatio,damageOverTimeDuration:s.damageOverTimeDuration,armorDamageRatio:s.armorDamageRatio+(this.level-1)*s.armorDamageRatioLevelBonus,hpDrainRatio:s.hpDrainRatio,pierceChance:s.pierceChance,blindChance:s.blindChance,blindDuration:s.blindDuration,silenceChance:s.silenceChance,silenceDuration:s.silenceDuration,stunChance:s.stunChance,stunDuration:s.stunDuration,spendHpRatio:s.spendHpRatio,buffs:null};if(s.buffs){r.buffs=[];for(let n of s.buffs)r.buffs.push(new C(n,this.level))}this.abilityEffects.push(r)}if(a)this.triggers=a;else{this.triggers=[];for(let s of i.defaultCombatTriggers){let r=new J(s.dependencyHrid,s.conditionHrid,s.comparatorHrid,s.value);this.triggers.push(r)}}this.lastUsed=Number.MIN_SAFE_INTEGER}static createFromDTO(t){let e=t.triggers.map(i=>J.createFromDTO(i));return new o(t.hrid,t.level,e)}shouldTrigger(t,e,a,i,s){if(e.isStunned||e.isSilenced)return!1;let r=e.combatDetails.combatStats.abilityHaste,n=this.cooldownDuration;if(r>0&&(n=n*100/(100+r)),this.lastUsed+n>t)return!1;if(this.triggers.length==0)return!0;let c=!0;for(let l of this.triggers)l.isActive(e,a,i,s,t)||(c=!1);return c}},U=me;var ue=class{constructor(){u(this,"isPlayer");u(this,"isStunned",!1);u(this,"stunExpireTime",null);u(this,"isBlinded",!1);u(this,"blindExpireTime",null);u(this,"isSilenced",!1);u(this,"silenceExpireTime",null);u(this,"isOutOfMana",!1);u(this,"staminaLevel",1);u(this,"intelligenceLevel",1);u(this,"attackLevel",1);u(this,"meleeLevel",1);u(this,"defenseLevel",1);u(this,"rangedLevel",1);u(this,"magicLevel",1);u(this,"experience",0);u(this,"experienceRate",0);u(this,"enrageTime",0);u(this,"abilities",[null,null,null,null]);u(this,"food",[null,null,null]);u(this,"drinks",[null,null,null]);u(this,"houseRooms",[]);u(this,"achievements",null);u(this,"dropTable",[]);u(this,"rareDropTable",[]);u(this,"abilityManaCosts",new Map);u(this,"combatDetails",{staminaLevel:1,intelligenceLevel:1,attackLevel:1,meleeLevel:1,defenseLevel:1,rangedLevel:1,magicLevel:1,maxHitpoints:110,currentHitpoints:110,maxManapoints:110,currentManapoints:110,stabAccuracyRating:11,slashAccuracyRating:11,smashAccuracyRating:11,rangedAccuracyRating:11,magicAccuracyRating:11,stabMaxDamage:11,slashMaxDamage:11,smashMaxDamage:11,rangedMaxDamage:11,magicMaxDamage:11,stabEvasionRating:11,slashEvasionRating:11,smashEvasionRating:11,rangedEvasionRating:11,magicEvasionRating:11,defensiveMaxDamage:0,totalArmor:.2,totalWaterResistance:.4,totalNatureResistance:.4,totalFireResistance:.4,abilityHaste:0,tenacity:0,totalThreat:100,combatStats:{combatStyleHrid:"/combat_styles/smash",damageType:"/damage_types/physical",attackInterval:3e9,autoAttackDamage:0,abilityDamage:0,criticalRate:0,criticalDamage:0,stabAccuracy:0,slashAccuracy:0,smashAccuracy:0,rangedAccuracy:0,magicAccuracy:0,stabDamage:0,slashDamage:0,smashDamage:0,rangedDamage:0,magicDamage:0,defensiveDamage:0,taskDamage:0,physicalAmplify:0,waterAmplify:0,natureAmplify:0,fireAmplify:0,healingAmplify:0,physicalThorns:0,elementalThorns:0,maxHitpoints:0,maxManapoints:0,stabEvasion:0,slashEvasion:0,smashEvasion:0,rangedEvasion:0,magicEvasion:0,armor:0,waterResistance:0,natureResistance:0,fireResistance:0,lifeSteal:0,hpRegenPer10:.01,mpRegenPer10:.01,combatDropRate:0,combatDropQuantity:0,combatRareFind:0,combatExperience:0,foodSlots:1,drinkSlots:1,armorPenetration:0,waterPenetration:0,naturePenetration:0,firePenetration:0,manaLeech:0,castSpeed:0,threat:100,parry:0,mayhem:0,pierce:0,curse:0,ripple:0,bloom:0,blaze:0,weaken:0,fury:0,foodHaste:0,drinkConcentration:0,damageTaken:0,attackSpeed:0,armorDamageRatio:0,hpDrainRatio:0,primaryTraining:"",focusTraining:"",staminaExperience:0,intelligenceExperience:0,attackExperience:0,defenseExperience:0,meleeExperience:0,rangedExperience:0,magicExperience:0,retaliation:0,maxHitpointsRatio:0,maxManapointsRatio:0}});u(this,"combatBuffs",{});u(this,"permanentBuffs",{});u(this,"zoneBuffs",{});u(this,"extraBuffs",{})}updateCombatDetails(){this.isPlayer&&(this.combatDetails.combatStats.hpRegenPer10===0?this.combatDetails.combatStats.hpRegenPer10=.01:this.combatDetails.combatStats.hpRegenPer10=.01+this.combatDetails.combatStats.hpRegenPer10,this.combatDetails.combatStats.mpRegenPer10===0?this.combatDetails.combatStats.mpRegenPer10=.01:this.combatDetails.combatStats.mpRegenPer10=.01+this.combatDetails.combatStats.mpRegenPer10),["stamina","intelligence","attack","melee","defense","ranged","magic"].forEach(d=>{this.combatDetails[d+"Level"]=this[d+"Level"],this.getBuffBoosts("/buff_types/"+d+"_level").forEach(L=>{this.combatDetails[d+"Level"]+=this[d+"Level"]*L.ratioBoost,this.combatDetails[d+"Level"]+=L.flatBoost})}),this.combatDetails.maxHitpoints=Math.floor((10*(10+this.combatDetails.staminaLevel)+this.combatDetails.combatStats.maxHitpoints)*(1+this.combatDetails.combatStats.maxHitpointsRatio)),this.combatDetails.maxManapoints=Math.floor((10*(10+this.combatDetails.intelligenceLevel)+this.combatDetails.combatStats.maxManapoints)*(1+this.combatDetails.combatStats.maxManapointsRatio));let t=this.getBuffBoost("/buff_types/fury_accuracy").ratioBoost,e=this.getBuffBoost("/buff_types/fury_damage").ratioBoost,a=this.getBuffBoost("/buff_types/accuracy").ratioBoost,i=this.getBuffBoost("/buff_types/damage").ratioBoost;["stab","slash","smash"].forEach(d=>{this.combatDetails[d+"AccuracyRating"]=(10+this.combatDetails.attackLevel)*(1+this.combatDetails.combatStats[d+"Accuracy"])*(1+a)*(1+t),this.combatDetails[d+"MaxDamage"]=(10+this.combatDetails.meleeLevel)*(1+this.combatDetails.combatStats[d+"Damage"])*(1+i)*(1+e);let R=(10+this.combatDetails.defenseLevel)*(1+this.combatDetails.combatStats[d+"Evasion"]);this.combatDetails[d+"EvasionRating"]=R;let L=this.getBuffBoosts("/buff_types/evasion");for(let I of L)this.combatDetails[d+"EvasionRating"]+=I.flatBoost,this.combatDetails[d+"EvasionRating"]+=R*I.ratioBoost}),this.combatDetails.defensiveMaxDamage=(10+this.combatDetails.defenseLevel)*(1+this.combatDetails.combatStats.defensiveDamage)*(1+i)*(1+e),this.equipment?.["/equipment_types/two_hand"]?.hrid.includes("bulwark")&&(this.combatDetails.smashMaxDamage+=this.combatDetails.defensiveMaxDamage),this.combatDetails.rangedAccuracyRating=(10+this.combatDetails.attackLevel)*(1+this.combatDetails.combatStats.rangedAccuracy)*(1+a)*(1+t),this.combatDetails.rangedMaxDamage=(10+this.combatDetails.rangedLevel)*(1+this.combatDetails.combatStats.rangedDamage)*(1+i)*(1+e);let s=(10+this.combatDetails.defenseLevel)*(1+this.combatDetails.combatStats.rangedEvasion);this.combatDetails.rangedEvasionRating=s;let r=this.getBuffBoosts("/buff_types/evasion");for(let d of r)this.combatDetails.rangedEvasionRating+=d.flatBoost,this.combatDetails.rangedEvasionRating+=s*d.ratioBoost;this.combatDetails.combatStats.damageTaken=this.getBuffBoost("/buff_types/damage_taken").flatBoost,this.combatDetails.magicAccuracyRating=(10+this.combatDetails.attackLevel)*(1+this.combatDetails.combatStats.magicAccuracy)*(1+a)*(1+t),this.combatDetails.magicMaxDamage=(10+this.combatDetails.magicLevel)*(1+this.combatDetails.combatStats.magicDamage)*(1+i)*(1+e);let n=(10+this.combatDetails.defenseLevel)*(1+this.combatDetails.combatStats.magicEvasion);this.combatDetails.magicEvasionRating=n;for(let d of r)this.combatDetails.magicEvasionRating+=d.flatBoost,this.combatDetails.magicEvasionRating+=n*d.ratioBoost;this.combatDetails.combatStats.physicalAmplify+=this.getBuffBoost("/buff_types/physical_amplify").flatBoost,this.combatDetails.combatStats.waterAmplify+=this.getBuffBoost("/buff_types/water_amplify").flatBoost,this.combatDetails.combatStats.natureAmplify+=this.getBuffBoost("/buff_types/nature_amplify").flatBoost,this.combatDetails.combatStats.fireAmplify+=this.getBuffBoost("/buff_types/fire_amplify").flatBoost,this.combatDetails.combatStats.healingAmplify+=this.getBuffBoost("/buff_types/healing_amplify").flatBoost,this.combatDetails.combatStats.attackInterval/=1+this.combatDetails.attackLevel/2e3;let c=this.combatDetails.combatStats.attackSpeed;this.combatDetails.combatStats.attackInterval/=1+c;let h=this.getBuffBoosts("/buff_types/attack_speed").map(d=>d.ratioBoost).reduce((d,R)=>d+R,0);this.combatDetails.combatStats.attackInterval/=1+h;let m=.2*this.combatDetails.defenseLevel+this.combatDetails.combatStats.armor;this.combatDetails.totalArmor=m;let f=this.getBuffBoosts("/buff_types/armor");for(let d of f)this.combatDetails.totalArmor+=d.flatBoost,this.combatDetails.totalArmor+=m*d.ratioBoost;let p=.2*this.combatDetails.defenseLevel+this.combatDetails.combatStats.waterResistance;this.combatDetails.totalWaterResistance=p;let y=this.getBuffBoosts("/buff_types/water_resistance");for(let d of y)this.combatDetails.totalWaterResistance+=d.flatBoost,this.combatDetails.totalWaterResistance+=p*d.ratioBoost;let b=.2*this.combatDetails.defenseLevel+this.combatDetails.combatStats.natureResistance;this.combatDetails.totalNatureResistance=b;let T=this.getBuffBoosts("/buff_types/nature_resistance");for(let d of T)this.combatDetails.totalNatureResistance+=d.flatBoost,this.combatDetails.totalNatureResistance+=b*d.ratioBoost;let Q=.2*this.combatDetails.defenseLevel+this.combatDetails.combatStats.fireResistance;this.combatDetails.totalFireResistance=Q;let ht=this.getBuffBoosts("/buff_types/fire_resistance");for(let d of ht)this.combatDetails.totalFireResistance+=d.flatBoost,this.combatDetails.totalFireResistance+=Q*d.ratioBoost;let mt=this.getBuffBoost("/buff_types/hp_regen");this.combatDetails.combatStats.hpRegenPer10+=this.combatDetails.combatStats.hpRegenPer10*mt.ratioBoost,this.combatDetails.combatStats.hpRegenPer10+=mt.flatBoost;let ut=this.getBuffBoost("/buff_types/mp_regen");this.combatDetails.combatStats.mpRegenPer10+=this.combatDetails.combatStats.mpRegenPer10*ut.ratioBoost,this.combatDetails.combatStats.mpRegenPer10+=ut.flatBoost,this.combatDetails.combatStats.lifeSteal+=this.getBuffBoost("/buff_types/life_steal").flatBoost,this.combatDetails.combatStats.physicalThorns+=this.getBuffBoost("/buff_types/physical_thorns").flatBoost,this.combatDetails.combatStats.elementalThorns+=this.getBuffBoost("/buff_types/elemental_thorns").flatBoost,this.combatDetails.combatStats.combatExperience+=this.getBuffBoost("/buff_types/wisdom").flatBoost,this.combatDetails.combatStats.criticalRate+=this.getBuffBoost("/buff_types/critical_rate").flatBoost,this.combatDetails.combatStats.criticalDamage+=this.getBuffBoost("/buff_types/critical_damage").flatBoost,this.combatDetails.combatStats.castSpeed+=this.getBuffBoost("/buff_types/cast_speed").flatBoost,this.combatDetails.combatStats.castSpeed+=this.combatDetails.attackLevel/2e3;let tt=this.getBuffBoost("/buff_types/combat_drop_rate");this.combatDetails.combatStats.combatDropRate+=(1+this.combatDetails.combatStats.combatDropRate)*tt.ratioBoost,this.combatDetails.combatStats.combatDropRate+=tt.flatBoost;let pt=this.getBuffBoost("/buff_types/rare_find");this.combatDetails.combatStats.combatRareFind+=(1+this.combatDetails.combatStats.combatRareFind)*pt.ratioBoost,this.combatDetails.combatStats.combatRareFind+=pt.flatBoost;let et=this.getBuffBoost("/buff_types/combat_drop_quantity");this.combatDetails.combatStats.combatDropQuantity+=(1+this.combatDetails.combatStats.combatDropQuantity)*et.ratioBoost,this.combatDetails.combatStats.combatDropQuantity+=et.flatBoost;let W=100+this.combatDetails.combatStats.threat;this.combatDetails.totalThreat=W;let O=this.getBuffBoost("/buff_types/threat");O.ratioBoost!==0?this.combatDetails.combatStats.threat+=W*O.ratioBoost:this.combatDetails.combatStats.threat=W,this.combatDetails.combatStats.threat+=O.flatBoost,this.combatDetails.combatStats.retaliation+=this.getBuffBoost("/buff_types/retaliation").flatBoost,this.combatDetails.combatStats.tenacity+=this.getBuffBoost("/buff_types/tenacity").flatBoost}addBuffs(t,e){t.forEach(i=>i.startTime=e);let a=!1;for(let i of t)(!this.combatBuffs[i.uniqueHrid]||this.combatBuffs[i.uniqueHrid].ratioBoost!=i.ratioBoost||this.combatBuffs[i.uniqueHrid].flatBoost!=i.flatBoost)&&(a=!0),this.combatBuffs[i.uniqueHrid]=i;a&&this.updateCombatDetails()}addBuff(t,e){t.startTime=e;let a=!0;this.combatBuffs[t.uniqueHrid]&&this.combatBuffs[t.uniqueHrid].ratioBoost===t.ratioBoost&&this.combatBuffs[t.uniqueHrid].flatBoost===t.flatBoost&&(a=!1),this.combatBuffs[t.uniqueHrid]=t,a&&this.updateCombatDetails()}removeBuffs(t){let e=!1;t.forEach(a=>{this.combatBuffs[a.uniqueHrid]&&(delete this.combatBuffs[a.uniqueHrid],e=!0)}),e&&this.updateCombatDetails()}removeBuff(t){this.combatBuffs[t.uniqueHrid]&&(delete this.combatBuffs[t.uniqueHrid],this.updateCombatDetails())}addPermanentBuff(t){this.permanentBuffs[t.typeHrid]?(this.permanentBuffs[t.typeHrid].flatBoost+=t.flatBoost,this.permanentBuffs[t.typeHrid].ratioBoost+=t.ratioBoost):this.permanentBuffs[t.typeHrid]={uniqueHrid:t.uniqueHrid,typeHrid:t.typeHrid,flatBoost:t.flatBoost,ratioBoost:t.ratioBoost,duration:t.duration}}generatePermanentBuffs(){for(let t=0;t<this.houseRooms.length;t++)this.houseRooms[t].buffs.forEach(a=>{this.addPermanentBuff(a)});this.achievements&&this.achievements.buffs.forEach(t=>{this.addPermanentBuff(t)}),this.zoneBuffs&&this.zoneBuffs.forEach(t=>{this.addPermanentBuff(t)}),this.extraBuffs&&this.extraBuffs.forEach(t=>{this.addPermanentBuff(t)})}removeExpiredBuffs(t){Object.values(this.combatBuffs).filter(a=>a.startTime+a.duration<=t).forEach(a=>{delete this.combatBuffs[a.uniqueHrid]}),this.updateCombatDetails()}clearBuffs(){this.combatBuffs=structuredClone(this.permanentBuffs),this.updateCombatDetails()}clearCCs(){this.isStunned=!1,this.stunExpireTime=null,this.isSilenced=!1,this.silenceExpireTime=null,this.isBlinded=!1,this.blindExpireTime=null,this.combatDetails.combatStats.damageTaken=0}getBuffBoosts(t){let e=[];return Object.values(this.combatBuffs).filter(a=>a.typeHrid==t).forEach(a=>{e.push({ratioBoost:a.ratioBoost,flatBoost:a.flatBoost})}),e}getBuffBoost(t){let e=this.getBuffBoosts(t),a={ratioBoost:0,flatBoost:0};for(let i=0;i<e.length;i++)a.ratioBoost+=e[i]?.ratioBoost??0,a.flatBoost+=e[i]?.flatBoost??0;return a}reset(t=0){this.clearCCs(),t==0||!this.isPlayer?(this.clearBuffs(),this.resetCooldowns(t)):this.removeExpiredBuffs(t),this.combatDetails.currentHitpoints=this.combatDetails.maxHitpoints,this.combatDetails.currentManapoints=this.combatDetails.maxManapoints}resetCooldowns(t=0){this.food.filter(a=>a!=null).forEach(a=>a.lastUsed=Number.MIN_SAFE_INTEGER),this.drinks.filter(a=>a!=null).forEach(a=>a.lastUsed=Number.MIN_SAFE_INTEGER);let e=this.combatDetails.combatStats.abilityHaste;this.abilities.filter(a=>a!=null).forEach(a=>{if(this.isPlayer)a.lastUsed=Number.MIN_SAFE_INTEGER;else{let i=a.cooldownDuration;e>0&&(i=i*100/(100+e)),a.lastUsed=t-Math.floor(i*.5)+Math.floor(Math.random()*i*.5)}})}addHitpoints(t){let e=0;if(this.combatDetails.currentHitpoints>=this.combatDetails.maxHitpoints)return e;let a=Math.min(this.combatDetails.currentHitpoints+t,this.combatDetails.maxHitpoints);return e=a-this.combatDetails.currentHitpoints,this.combatDetails.currentHitpoints=a,e}addManapoints(t){let e=0;if(this.combatDetails.currentManapoints>=this.combatDetails.maxManapoints)return e;let a=Math.min(this.combatDetails.currentManapoints+t,this.combatDetails.maxManapoints);return e=a-this.combatDetails.currentManapoints,this.combatDetails.currentManapoints=a,e}},kt=ue;var pe=S("combatMonsterDetailMap");var fe=class{constructor(t,e,a,i,s){this.itemHrid=t,this.dropRate=e,this.minCount=a,this.maxCount=i,this.difficultyTier=s}},de=fe;var be=class extends kt{constructor(e,a=0,i=0){super();u(this,"difficultyTier",0);u(this,"LabyrinthMonsterBaseRoomLevel",100);u(this,"roomLevel",0);this.isPlayer=!1,this.hrid=e,this.difficultyTier=a,this.roomLevel=i,this.roomLevel<=0&&(this.roomLevel=this.LabyrinthMonsterBaseRoomLevel);let s=pe[this.hrid];if(!s)throw new Error("No monster found for hrid: "+this.hrid);this.enrageTime=s.enrageTime;let r=this.roomLevel/this.LabyrinthMonsterBaseRoomLevel;for(let n=0;n<s.abilities.length;n++)s.abilities[n].minDifficultyTier>this.difficultyTier||(this.abilities[n]=new U(s.abilities[n].abilityHrid,Math.floor(s.abilities[n].level*r)));if(s.dropTable)for(let n=0;n<s.dropTable.length;n++)this.dropTable[n]=new de(s.dropTable[n].itemHrid,s.dropTable[n].dropRate,s.dropTable[n].minCount,s.dropTable[n].maxCount,s.dropTable[n].difficultyTier);for(let n=0;n<s.rareDropTable.length;n++){let l=(s.dropTable&&n<s.dropTable.length?s.dropTable[n]:null)?.difficultyTier??s.rareDropTable[n].minDifficultyTier;this.rareDropTable[n]=new de(s.rareDropTable[n].itemHrid,s.rareDropTable[n].dropRate,s.rareDropTable[n].minCount,l)}}updateCombatDetails(){let e=pe[this.hrid],a=1+.25*this.difficultyTier,i=1+.15*this.difficultyTier,s=20*this.difficultyTier,r=this.roomLevel/this.LabyrinthMonsterBaseRoomLevel;this.staminaLevel=a*(e.combatDetails.staminaLevel+s)*r,this.intelligenceLevel=a*(e.combatDetails.intelligenceLevel+s)*r,this.attackLevel=a*(e.combatDetails.attackLevel+s)*r,this.meleeLevel=a*(e.combatDetails.meleeLevel+s)*r,this.defenseLevel=i*(e.combatDetails.defenseLevel+s)*r,this.rangedLevel=a*(e.combatDetails.rangedLevel+s)*r,this.magicLevel=a*(e.combatDetails.magicLevel+s)*r;let n=1+.5*this.difficultyTier,c=5*this.difficultyTier;this.experience=n*(e.experience+c),this.combatDetails.combatStats.combatStyleHrid=e.combatDetails.combatStats.combatStyleHrids[0];for(let[l,h]of Object.entries(e.combatDetails.combatStats))this.combatDetails.combatStats[l]=h;this.combatDetails.combatStats.armor*=r,this.combatDetails.combatStats.waterResistance*=r,this.combatDetails.combatStats.natureResistance*=r,this.combatDetails.combatStats.fireResistance*=r,["stabAccuracy","slashAccuracy","smashAccuracy","rangedAccuracy","magicAccuracy","stabDamage","slashDamage","smashDamage","rangedDamage","magicDamage","defensiveDamage","taskDamage","physicalAmplify","waterAmplify","natureAmplify","fireAmplify","healingAmplify","stabEvasion","slashEvasion","smashEvasion","rangedEvasion","magicEvasion","armor","waterResistance","natureResistance","fireResistance","maxHitpoints","maxManapoints","lifeSteal","hpRegenPer10","mpRegenPer10","physicalThorns","elementalThorns","combatDropRate","combatRareFind","combatDropQuantity","combatExperience","criticalRate","criticalDamage","armorPenetration","waterPenetration","naturePenetration","firePenetration","abilityHaste","tenacity","manaLeech","castSpeed","threat","parry","mayhem","pierce","curse","fury","weaken","ripple","bloom","blaze","attackSpeed","foodHaste","drinkConcentration","autoAttackDamage","abilityDamage","retaliation"].forEach(l=>{e.combatDetails.combatStats[l]==null&&(this.combatDetails.combatStats[l]=0)}),this.combatDetails.combatStats.attackInterval==0&&(this.combatDetails.combatStats.attackInterval=e.combatDetails.attackInterval),super.updateCombatDetails()}},z=be;var F=1e9,ge=5*F,ye=3*F,Pe=10*F,na=3*F,oa=150*F,la=3*F,X=60*F,De=class extends EventTarget{constructor(t,e,a,i={}){super(),this.players=t,this.zone=e,this.labyrinth=a,this.eventQueue=new Ce,this.simResult=new ne(e,a,t.length),this.allPlayersDead=!1,this.enableHpMpVisualization=i.enableHpMpVisualization||!1,this.wipeLogs={buffer:new Array(200),index:0,count:0,maxSize:200}}addToWipeLogs(t){let{buffer:e,maxSize:a}=this.wipeLogs;e[this.wipeLogs.index]=t,this.wipeLogs.index=(this.wipeLogs.index+1)%a,this.wipeLogs.count=Math.min(this.wipeLogs.count+1,a)}logAndResetWipeLogs(){this.getOrderedWipeLogs().forEach(e=>{if(e.error)return;let a=(e.time/1e9).toFixed(2)}),this.wipeLogs.index=0,this.wipeLogs.count=0}buildCombatLog(t,e,a,i){try{let s=t?.hrid||"UNKNOWN_SOURCE",r=a?.hrid||"UNKNOWN_TARGET",n=a?.combatDetails?.currentHitpoints||0,c=Math.max(0,n+i),l=this.players.map(h=>({hrid:h.hrid||"UNKNOWN_PLAYER",current:h.combatDetails?.currentHitpoints??0,max:h.combatDetails?.maxHitpoints??0}));return{time:this.simulationTime,wave:this.zone.encountersKilled-1,source:s,ability:e,target:r,damage:i,beforeHp:c,afterHp:n,playersHp:l,isCrit:!1}}catch(s){return{error:`[\\u65E5\\u5FD7\\u751F\\u6210\\u9519\\u8BEF] ${s.message}`}}}generateCombatLog(t,e,a,i){try{let s=t?.hrid||"UNKNOWN_SOURCE",r=a?.hrid||"UNKNOWN_TARGET",n=i?.damageDone||0,c=a?.combatDetails?.currentHitpoints||0,l=Math.max(0,c+n),h=this.players.map(m=>({hrid:m.hrid||"UNKNOWN_PLAYER",current:m.combatDetails?.currentHitpoints??0,max:m.combatDetails?.maxHitpoints??0}));return{time:this.simulationTime,wave:this.zone.encountersKilled-1,source:s,ability:e,target:r,damage:n,beforeHp:l,afterHp:c,playersHp:h,isCrit:i?.isCrit||!1}}catch(s){return{error:`[\\u65E5\\u5FD7\\u751F\\u6210\\u9519\\u8BEF] ${s.message}`}}}getOrderedWipeLogs(){let{buffer:t,maxSize:e,count:a}=this.wipeLogs,i=[];for(let s=0;s<a;s++){let r=(this.wipeLogs.index-a+e+s)%e;i.push(t[r])}return i}saveWipeLogsToSimResult(t){let e=this.getOrderedWipeLogs();this.simResult.addWipeEvent(e,this.simulationTime,t)}async simulate(t){this.reset();let e=0,a=new it(0);for(this.eventQueue.addEvent(a);this.simulationTime<t;){let i=this.eventQueue.getNextEvent();if(await this.processEvent(i),e++,e==1e3){e=0,this.enableHpMpVisualization&&this.simResult.addTimeSeriesSnapshot(this.simulationTime,this.players);let s=new CustomEvent("progress",{detail:{zone:this.zone?.hrid,difficultyTier:this.zone?.difficultyTier,labyrinth:this.labyrinth?.hrid,roomLevel:this.labyrinth?.roomLevel,progress:Math.min(this.simulationTime/t,1),timeSeriesData:this.enableHpMpVisualization?this.simResult.timeSeriesData:null}});this.dispatchEvent(s)}}if(this.simResult.isDungeon=this.zone?.isDungeon??!1,this.zone&&this.simResult.isDungeon)if(this.simResult.dungeonsCompleted=this.zone.dungeonsCompleted,this.simResult.dungeonsFailed=this.zone.dungeonsFailed,this.simResult.dungeonsCompleted<1){this.simResult.maxWaveReached=0;for(let i=1;i<=this.zone.dungeonSpawnInfo.maxWaves;i++){let s="#"+i.toString(),r=this.simResult.timeSpentAlive.findIndex(n=>n.name===s);if(r==-1||this.simResult.timeSpentAlive[r].count==0)break;this.simResult.maxWaveReached=i}}else this.simResult.maxWaveReached=this.zone.dungeonSpawnInfo.maxWaves;this.simResult.simulatedTime=this.simulationTime;for(let i=0;i<this.players.length;i++)this.simResult.setDropRateMultipliers(this.players[i]),this.simResult.setManaUsed(this.players[i]);if(this.zone?.isDungeon&&Object.entries(this.zone.dungeonSpawnInfo.fixedSpawnsMap).forEach(([i,s])=>{let r="#"+i.toString();s.forEach(n=>{r+=","+n.combatMonsterHrid}),this.simResult.bossSpawns.push(r)}),this.zone?.isDungeon&&this.zone.monsterSpawnInfo.bossSpawns)for(let i of this.zone.monsterSpawnInfo.bossSpawns)this.simResult.bossSpawns.push(i.combatMonsterHrid);return this.labyrinth&&(this.simResult.labyAttemptCount=this.labyrinth.attemptCount),this.simResult}reset(){this.tempDungeonCount=0,this.simulationTime=0,this.eventQueue.clear(),this.simResult=new ne(this.zone,this.labyrinth,this.players.length)}async processEvent(t){switch(this.simulationTime=t.time,t.type){case it.type:this.processCombatStartEvent(t);break;case rt.type:this.processPlayerRespawnEvent(t);break;case jt.type:this.processEnemyRespawnEvent(t);break;case k.type:this.processAutoAttackEvent(t);break;case st.type:this.processConsumableTickEvent(t);break;case at.type:this.processDamageOverTimeTickEvent(t);break;case j.type:this.processCheckBuffExpirationEvent(t);break;case nt.type:this.processRegenTickEvent(t);break;case ot.type:this.processStunExpirationEvent(t);break;case lt.type:this.processBlindExpirationEvent(t);break;case ct.type:this.processSilenceExpirationEvent(t);break;case P.type:this.processCurseExpirationEvent(t);break;case N.type:this.processWeakenExpirationEvent(t);break;case q.type:this.processFuryExpirationEvent(t);break;case Y.type:this.processEnrageTickEvent(t);break;case M.type:this.tryUseAbility(t.source,t.ability);break;case $.type:this.addNextAttackEvent(t.source);break;case Gt.type:break}this.checkTriggers()}processCombatStartEvent(t){for(let a=0;a<this.players.length;a++)t.time==0&&this.players[a].generatePermanentBuffs(),this.labyrinth?this.players[a].reset():this.players[a].reset(this.simulationTime);let e=new nt(this.simulationTime+Pe);this.eventQueue.addEvent(e),this.startNewEncounter()}processPlayerRespawnEvent(t){let e=this.players.find(a=>a.hrid===t.hrid);e.combatDetails.currentHitpoints=e.combatDetails.maxHitpoints,e.combatDetails.currentManapoints=e.combatDetails.maxManapoints,e.clearBuffs(),e.clearCCs(),this.allPlayersDead?(this.allPlayersDead=!1,this.startAttacks()):this.addNextAttackEvent(e)}processEnemyRespawnEvent(t){this.startNewEncounter()}startNewEncounter(){if(this.allPlayersDead&&(this.allPlayersDead=!1,this.zone&&this.zone.failWave()),this.zone)if(!this.zone.isDungeon)this.enemies=this.zone.getRandomEncounter();else{this.enemies=this.zone.getNextWave(),this.simResult.updateTimeSpentAlive("#"+(this.zone.encountersKilled-1).toString(),!0,this.simulationTime);let e=this.zone.dungeonsCompleted;if(e>this.tempDungeonCount){this.tempDungeonCount=e;for(let a=0;a<this.players.length;a++)this.players[a].combatDetails.currentHitpoints=this.players[a].combatDetails.maxHitpoints,this.players[a].combatDetails.currentManapoints=this.players[a].combatDetails.maxManapoints}}this.labyrinth&&(this.enemies=this.labyrinth.getMonster(),this.labyrinth.updateEnconterStartTime(this.simulationTime)),this.enemies.forEach(e=>{e.reset(this.simulationTime),this.simResult.updateTimeSpentAlive(e.hrid,!0,this.simulationTime)}),this.eventQueue.clearEventsOfType(Y.type);let t=new Y(this.simulationTime+X,X);this.eventQueue.addEvent(t),this.enrageBeginTime=this.simulationTime,this.eventQueue.clearEventsOfType(M.type),this.checkTriggers(),this.startAttacks()}startAttacks(){let t=[...this.players];this.enemies&&t.push(...this.enemies);for(let e of t)e.combatDetails.currentHitpoints<=0||this.addNextAttackEvent(e)}checkParry(t){let e=t.filter(i=>i&&i.combatDetails.currentHitpoints>0&&i.combatDetails.combatStats.parry>0);if(e.length<=0)return;let a=Math.floor(Math.random()*e.length);if(e[a].combatDetails.combatStats.parry>Math.random())return e[a]}processAutoAttackEvent(t){let e=t.source.isPlayer?this.enemies:this.players;if(!e)return;let a=e.filter(i=>i&&i.combatDetails.currentHitpoints>0);for(let i=0;i<a.length;i++){let s=a[i];if(!t.source.isPlayer&&a.length>1){let h=0,m=[];a.forEach(p=>{let y=p.combatDetails.combatStats.threat;h+=y,m.push({player:p,rangeStart:h-y,rangeEnd:h})});let f=Math.random()*h;s=m.find(p=>f>=p.rangeStart&&f<p.rangeEnd).player}let r=t.source,n=this.checkParry(e);n&&(s=r,r=n);let c=A.processAttack(r,s);if(this.zone?.isDungeon&&s.isPlayer&&c.didHit&&c.damageDone>0){let h=this.generateCombatLog(r,"autoAttack",s,c);this.addToWipeLogs(h)}let l=r.combatDetails.combatStats.mayhem>Math.random();if(c.didHit&&r.combatDetails.combatStats.curse>0){let m=this.eventQueue.getMatching(b=>b.type==P.type&&b.source==s),f=0;m&&(f=m.curseAmount),this.eventQueue.clearMatching(b=>b.type==P.type&&b.source==s);let p=new P(this.simulationTime+15e9,f,s),y={uniqueHrid:"/buff_uniques/curse",typeHrid:"/buff_types/damage_taken",ratioBoost:0,ratioBoostLevelBonus:0,flatBoost:r.combatDetails.combatStats.curse*p.curseAmount,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:15e9};s.addBuff(y,this.simulationTime),this.eventQueue.addEvent(p)}if(r.combatDetails.combatStats.fury>0){let h=this.eventQueue.getMatching(T=>T.type==q.type&&T.source==r);this.eventQueue.clearMatching(T=>T.type==q.type&&T.source==r);let m=15e9,f=5,p=0;h&&(p=h.furyAmount),c.didHit?p=Math.min(p+1,f):p=p/2;let y={uniqueHrid:"/buff_uniques/fury_accuracy",typeHrid:"/buff_types/fury_accuracy",ratioBoost:p*r.combatDetails.combatStats.fury,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:m},b={uniqueHrid:"/buff_uniques/fury_damage",typeHrid:"/buff_types/fury_damage",ratioBoost:p*r.combatDetails.combatStats.fury,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:m};if(p>0){let T=new q(this.simulationTime+m,p,r);this.eventQueue.addEvent(T),r.addBuffs([y,b],this.simulationTime)}else r.removeBuffs([y,b])}if(s.combatDetails.combatStats.weaken>0){let m=this.eventQueue.getMatching(b=>b.type==N.type&&b.source==r),f=0;m&&(f=m.weakenAmount),this.eventQueue.clearMatching(b=>b.type==N.type&&b.source==r);let p=new N(this.simulationTime+15e9,f,r),y={uniqueHrid:"/buff_uniques/weaken",typeHrid:"/buff_types/damage",ratioBoost:-1*s.combatDetails.combatStats.weaken*p.weakenAmount,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:15e9};r.addBuff(y,this.simulationTime),this.eventQueue.addEvent(p)}if(!l||l&&c.didHit||l&&i==a.length-1){let h="autoAttack";n&&(h="parry"),this.simResult.addAttack(r,s,h,c.didHit?c.damageDone:"miss")}if(c.lifeStealHeal>0&&this.simResult.addHitpointsGained(r,"lifesteal",c.lifeStealHeal),c.manaLeechMana>0&&this.simResult.addManapointsGained(r,"manaLeech",c.manaLeechMana),c.thornDamageDone>0&&this.simResult.addAttack(s,r,c.thornType,c.thornDamageDone),this.zone?.isDungeon&&c.thornDamageDone>0&&r.isPlayer){let h=this.buildCombatLog(s,c.thornType,r,c.thornDamageDone);this.addToWipeLogs(h)}if(s.combatDetails.combatStats.retaliation>0&&this.simResult.addAttack(s,r,"retaliation",c.retaliationDamageDone>0?c.retaliationDamageDone:"miss"),this.zone?.isDungeon&&c.retaliationDamageDone>0&&r.isPlayer){let h=this.buildCombatLog(s,"retaliation",r,c.retaliationDamageDone);this.addToWipeLogs(h)}if(s.combatDetails.currentHitpoints==0&&(this.eventQueue.clearEventsForUnit(s),this.simResult.addDeath(s),s.isPlayer||this.simResult.updateTimeSpentAlive(s.hrid,!1,this.simulationTime)),r.combatDetails.currentHitpoints==0&&(c.thornDamageDone!=0||c.retaliationDamageDone!=0)){this.eventQueue.clearEventsForUnit(r),this.simResult.addDeath(r),r.isPlayer||this.simResult.updateTimeSpentAlive(r.hrid,!1,this.simulationTime);break}if(!(l&&!c.didHit)&&(!c.didHit||n||r.combatDetails.combatStats.pierce<=Math.random()))break}this.checkEncounterEnd()||this.addNextAttackEvent(t.source)}checkEncounterEnd(){if(this.enemies){let e=this.enemies.filter(a=>a.combatDetails.currentHitpoints<=0&&a.experienceRate==0);e.length>0&&e.forEach(a=>{let i=this.simulationTime-this.enrageBeginTime;i>a.enrageTime&&(i=a.enrageTime),a.experienceRate=1+i/a.enrageTime})}let t=!1;if(this.enemies&&!this.enemies.some(e=>e.combatDetails.currentHitpoints>0)){this.eventQueue.clearEventsOfType(k.type);let e=new jt(this.simulationTime+na);this.eventQueue.addEvent(e),this.enemies.some(i=>i.experienceRate<=0);let a=this.enemies.map(i=>i.experience*i.experienceRate).reduce((i,s)=>i+s,0);this.players.forEach(i=>{this.simResult.addExperienceGain(i,a/this.players.length)}),this.enemies=null,this.zone?.isDungeon&&(this.simResult.updateTimeSpentAlive("#"+(this.zone.encountersKilled-1).toString(),!1,this.simulationTime),this.zone.encountersKilled>this.zone.dungeonSpawnInfo.maxWaves&&(this.simResult.updateDungenonFinish("#1",this.simulationTime),this.simResult.lastDungeonFinishTime=this.simulationTime)),this.simResult.addEncounterEnd(),this.simResult.lastEncounterFinishTime=this.simulationTime,t=!0}if(this.players.forEach(e=>{if(e.combatDetails.currentHitpoints<=0&&!this.eventQueue.containsEventOfTypeAndHrid(rt.type,e.hrid)){if(this.zone&&!this.zone.isDungeon){let a=new rt(this.simulationTime+oa,e.hrid);this.eventQueue.addEvent(a)}this.simResult.addRanOutOfManaCount(e,!1,this.simulationTime)}}),!this.players.some(e=>e.combatDetails.currentHitpoints>0)){if(this.zone)if(this.zone.isDungeon){this.saveWipeLogsToSimResult(this.zone.encountersKilled-1),this.wipeLogs.index=0,this.wipeLogs.count=0,this.eventQueue.clearEventsOfType(k.type),this.eventQueue.clearEventsOfType(M.type),this.eventQueue.clearEventsOfType(at.type),this.eventQueue.clearEventsOfType(st.type),this.eventQueue.clearEventsOfType(nt.type),this.eventQueue.clearEventsOfType(Y.type),this.eventQueue.clearEventsOfType(ot.type),this.eventQueue.clearEventsOfType(lt.type),this.eventQueue.clearEventsOfType(ct.type),this.eventQueue.clearEventsOfType($.type),this.enemies=null;let e=new it(this.simulationTime+la);this.eventQueue.addEvent(e)}else this.eventQueue.clearEventsOfType(k.type),this.eventQueue.clearEventsOfType(M.type);t=!0,this.allPlayersDead=!0}if(this.labyrinth&&(this.labyrinth.checkTimeout(this.simulationTime)||t)){this.enemies=null,t=!0,this.eventQueue.clear();let e=new it(this.simulationTime);this.eventQueue.addEvent(e)}return t}addNextAttackEvent(t){if(this.eventQueue.getMatching(n=>(n.type==M.type||n.type==k.type)&&n.source==t))return;let e,a,i;t.isPlayer?(e=A.getTarget(this.enemies),a=this.players,i=this.enemies):(e=A.getTarget(this.players),a=this.enemies,i=this.players);let s=!1,r=!1;if(t.abilities.filter(n=>n!=null).forEach(n=>{if(!s&&!r&&n.shouldTrigger(this.simulationTime,t,e,a,i)&&(this.canUseAbility(t,n,!0)||(r=!0),!r)){let c=n.castDuration;c/=1+t.combatDetails.combatStats.castSpeed;let l=new M(this.simulationTime+c,t,n);this.eventQueue.addEvent(l),s=!0}}),s){t.isOutOfMana=!1;return}if(i)if(t.isBlinded)t.isOutOfMana=!0;else{let n=new k(this.simulationTime+t.combatDetails.combatStats.attackInterval,t);this.eventQueue.addEvent(n)}}processConsumableTickEvent(t){if(t.consumable.hitpointRestore>0){let e=A.calculateTickValue(t.consumable.hitpointRestore,t.totalTicks,t.currentTick),a=t.source.addHitpoints(e);this.simResult.addHitpointsGained(t.source,t.consumable.hrid,a)}if(t.consumable.manapointRestore>0){let e=A.calculateTickValue(t.consumable.manapointRestore,t.totalTicks,t.currentTick),a=t.source.addManapoints(e);if(this.simResult.addManapointsGained(t.source,t.consumable.hrid,a),t.source.isOutOfMana){let i=new $(this.simulationTime,t.source);this.eventQueue.addEvent(i)}}if(t.currentTick<t.totalTicks){let e=new st(this.simulationTime+ge,t.source,t.consumable,t.totalTicks,t.currentTick+1);this.eventQueue.addEvent(e)}}processDamageOverTimeTickEvent(t){let e=A.calculateTickValue(t.damage,t.totalTicks,t.currentTick),a=Math.min(e,t.target.combatDetails.currentHitpoints);if(t.target.combatDetails.currentHitpoints-=a,this.simResult.addAttack(t.sourceRef,t.target,"damageOverTime",a),this.zone?.isDungeon&&t.target.isPlayer){let i=this.buildCombatLog("","damageOverTime",t.target,a);this.addToWipeLogs(i)}if(t.currentTick<t.totalTicks){let i=new at(this.simulationTime+ye,t.sourceRef,t.target,t.damage,t.totalTicks,t.currentTick+1,t.combatStyleHrid);this.eventQueue.addEvent(i)}t.target.combatDetails.currentHitpoints==0&&(this.eventQueue.clearEventsForUnit(t.target),this.simResult.addDeath(t.target),t.target.isPlayer||this.simResult.updateTimeSpentAlive(t.target.hrid,!1,this.simulationTime)),this.checkEncounterEnd()}processRegenTickEvent(t){let e=[...this.players];for(let i of e){if(i.combatDetails.currentHitpoints<=0)continue;let s=Math.floor(i.combatDetails.maxHitpoints*i.combatDetails.combatStats.hpRegenPer10),r=i.addHitpoints(s);this.simResult.addHitpointsGained(i,"regen",r);let n=Math.floor(i.combatDetails.maxManapoints*i.combatDetails.combatStats.mpRegenPer10),c=i.addManapoints(n);if(this.simResult.addManapointsGained(i,"regen",c),i.isOutOfMana){let l=new $(this.simulationTime,i);this.eventQueue.addEvent(l)}}let a=new nt(this.simulationTime+Pe);this.eventQueue.addEvent(a)}processCheckBuffExpirationEvent(t){t.source.removeExpiredBuffs(this.simulationTime)}processStunExpirationEvent(t){t.source.isStunned=!1,this.addNextAttackEvent(t.source)}processBlindExpirationEvent(t){t.source.isBlinded=!1,this.addNextAttackEvent(t.source)}processSilenceExpirationEvent(t){t.source.isSilenced=!1}processCurseExpirationEvent(t){t.source.removeExpiredBuffs(this.simulationTime)}processWeakenExpirationEvent(t){t.source.removeExpiredBuffs(this.simulationTime)}processFuryExpirationEvent(t){t.source.removeExpiredBuffs(this.simulationTime)}processEnrageTickEvent(t){if(!this.enemies)return;let e=10;this.enemies.filter(i=>i.combatDetails.currentHitpoints>0).forEach(i=>{let s=Math.min(e,Math.floor(t.encounterTime/i.enrageTime));if(s<=0)return;let r={uniqueHrid:"/buff_uniques/enrage_damage",typeHrid:"/buff_types/damage",ratioBoost:s*.1,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:X},n={uniqueHrid:"/buff_uniques/enrage_accuracy",typeHrid:"/buff_types/accuracy",ratioBoost:s*.1,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:X};i.addBuffs([r,n]),this.simResult.maxEnrageStack=Math.max(this.simResult.maxEnrageStack,s)});let a=new Y(this.simulationTime+X,t.encounterTime+X);this.eventQueue.addEvent(a)}checkTriggers(){let t;do t=!1,this.players.filter(e=>e.combatDetails.currentHitpoints>0).forEach(e=>{this.checkTriggersForUnit(e,this.players,this.enemies)&&(t=!0)}),this.enemies&&this.enemies.filter(e=>e.combatDetails.currentHitpoints>0).forEach(e=>{this.checkTriggersForUnit(e,this.enemies,this.players)&&(t=!0)});while(t)}checkTriggersForUnit(t,e,a){if(t.combatDetails.currentHitpoints<=0)throw new Error("Checking triggers for a dead unit");let i=!1,s=A.getTarget(a);for(let r of t.food)r&&r.shouldTrigger(this.simulationTime,t,s,e,a)&&this.tryUseConsumable(t,r)&&(i=!0);for(let r of t.drinks)r&&r.shouldTrigger(this.simulationTime,t,s,e,a)&&this.tryUseConsumable(t,r)&&(i=!0);return i}tryUseConsumable(t,e){if(t.combatDetails.currentHitpoints<=0)return!1;e.lastUsed=this.simulationTime;let a=e.cooldownDuration;t.combatDetails.combatStats.drinkConcentration>0&&e.catagoryHrid.includes("drink")?a=a/(1+t.combatDetails.combatStats.drinkConcentration):t.combatDetails.combatStats.foodHaste>0&&e.catagoryHrid.includes("food")&&(a=a/(1+t.combatDetails.combatStats.foodHaste));let i=new Gt(this.simulationTime+a);if(this.eventQueue.addEvent(i),this.simResult.addConsumableUse(t,e),e.recoveryDuration==0){if(e.hitpointRestore>0){let s=t.addHitpoints(e.hitpointRestore);this.simResult.addHitpointsGained(t,e.hrid,s)}if(e.manapointRestore>0){let s=t.addManapoints(e.manapointRestore);if(this.simResult.addManapointsGained(t,e.hrid,s),t.isOutOfMana){let r=new $(this.simulationTime,t);this.eventQueue.addEvent(r)}}}else{let s=new st(this.simulationTime+ge,t,e,e.recoveryDuration/ge,1);this.eventQueue.addEvent(s)}for(let s of e.buffs){let r=structuredClone(s);t.combatDetails.combatStats.drinkConcentration>0&&e.catagoryHrid.includes("drink")&&(r.ratioBoost*=1+t.combatDetails.combatStats.drinkConcentration,r.flatBoost*=1+t.combatDetails.combatStats.drinkConcentration,r.duration=r.duration/(1+t.combatDetails.combatStats.drinkConcentration)),t.addBuff(r,this.simulationTime);let n=new j(this.simulationTime+r.duration,t);this.eventQueue.addEvent(n)}return!0}canUseAbility(t,e,a){return t.combatDetails.currentHitpoints<=0?!1:t.combatDetails.currentManapoints<e.manaCost?(t.isPlayer&&a&&this.simResult.addRanOutOfManaCount(t,!0,this.simulationTime),!1):(t.isPlayer&&a&&this.simResult.addRanOutOfManaCount(t,!1,this.simulationTime),!0)}tryUseAbility(t,e){if(!this.canUseAbility(t,e,!0))return!1;t.isPlayer&&(t.abilityManaCosts.has(e.hrid)?t.abilityManaCosts.set(e.hrid,t.abilityManaCosts.get(e.hrid)+e.manaCost):t.abilityManaCosts.set(e.hrid,e.manaCost)),t.combatDetails.currentManapoints-=e.manaCost,e.lastUsed=this.simulationTime;let a=t.combatDetails.combatStats.abilityHaste,i=e.cooldownDuration;a>0&&(i=i*100/(100+a));let s=[e];t.combatDetails.combatStats.blaze>0&&Math.random()<t.combatDetails.combatStats.blaze&&s.push(new U("blaze")),t.combatDetails.combatStats.bloom>0&&Math.random()<t.combatDetails.combatStats.bloom&&s.push(new U("bloom"));for(let r of s)for(let n of r.abilityEffects)switch(n.effectType){case"/ability_effect_types/buff":this.processAbilityBuffEffect(t,r,n);break;case"/ability_effect_types/damage":this.processAbilityDamageEffect(t,r,n);break;case"/ability_effect_types/heal":this.processAbilityHealEffect(t,r,n);break;case"/ability_effect_types/spend_hp":this.processAbilitySpendHpEffect(t,r,n);break;case"/ability_effect_types/revive":this.processAbilityReviveEffect(t,r,n);break;case"/ability_effect_types/promote":this.eventQueue.clearEventsForUnit(t),t=this.processAbilityPromoteEffect(t,r,n),this.addNextAttackEvent(t);break;default:throw new Error("Unsupported effect type for ability: "+r.hrid+" effectType: "+n.effectType)}if(t.combatDetails.combatStats.ripple>0&&Math.random()<t.combatDetails.combatStats.ripple){let r=t.addManapoints(10);this.simResult.addManapointsGained(t,"ripple",r);for(let n of t.abilities)n&&n.lastUsed&&n.lastUsed+n.cooldownDuration-this.simulationTime>0&&(n.lastUsed=Math.max(n.lastUsed-F*2,this.simulationTime-n.cooldownDuration))}return this.addNextAttackEvent(t),t.combatDetails.currentHitpoints==0&&(this.eventQueue.clearEventsForUnit(t),this.simResult.addDeath(t),t.isPlayer||this.simResult.updateTimeSpentAlive(t.hrid,!1,this.simulationTime)),this.checkEncounterEnd(),!0}processAbilityBuffEffect(t,e,a){if(a.targetType=="allAllies"){let i=t.isPlayer?this.players:this.enemies;for(let s of i.filter(r=>r&&r.combatDetails.currentHitpoints>0))for(let r of a.buffs){if(e.isSpecialAbility&&r.multiplierForSkillHrid&&r.multiplierPerSkillLevel>0){let c=1+t.combatDetails[r.multiplierForSkillHrid.split("/")[2]+"Level"]*r.multiplierPerSkillLevel,l=structuredClone(r);l.flatBoost*=c,l.ratioBoost*=c,s.addBuff(l,this.simulationTime)}else s.addBuff(r,this.simulationTime);let n=new j(this.simulationTime+r.duration,s);this.eventQueue.addEvent(n)}return}if(a.targetType!="self")throw new Error("Unsupported target type for buff ability effect: "+e.hrid);for(let i of a.buffs){t.addBuff(i,this.simulationTime);let s=new j(this.simulationTime+i.duration,t);this.eventQueue.addEvent(s)}}processAbilityDamageEffect(t,e,a){let i;switch(a.targetType){case"enemy":case"allEnemies":i=t.isPlayer?this.enemies:this.players;break;default:throw new Error("Unsupported target type for damage ability effect: "+e.hrid)}if(!i)return;let s=[],r=!1;for(let n of i.filter(c=>c&&c.combatDetails.currentHitpoints>0)){let c;if(r||(c=this.checkParry(i),r=!0),c){let l=t,h=c,m=A.processAttack(h,l);this.simResult.addAttack(h,l,"parry",m.didHit?m.damageDone:"miss"),m.lifeStealHeal>0&&this.simResult.addHitpointsGained(h,"lifesteal",m.lifeStealHeal),m.manaLeechMana>0&&this.simResult.addManapointsGained(h,"manaLeech",m.manaLeechMana),m.thornDamageDone>0&&this.simResult.addAttack(l,h,m.thornType,m.thornDamageDone),l.combatDetails.combatStats.retaliation>0&&this.simResult.addAttack(l,h,"retaliation",m.retaliationDamageDone>0?m.retaliationDamageDone:"miss"),l.combatDetails.currentHitpoints==0&&(this.eventQueue.clearEventsForUnit(l),this.simResult.addDeath(l),l.isPlayer||this.simResult.updateTimeSpentAlive(l.hrid,!1,this.simulationTime)),h.combatDetails.currentHitpoints==0&&(m.thornDamageDone!=0||m.retaliationDamageDone!=0)&&(this.eventQueue.clearEventsForUnit(h),this.simResult.addDeath(h),h.isPlayer||this.simResult.updateTimeSpentAlive(h.hrid,!1,this.simulationTime))}else{if(i=i.filter(h=>h&&!s.includes(h.hrid)&&h.combatDetails.currentHitpoints>0),!t.isPlayer&&i.length>0&&a.targetType=="enemy"){let h=0,m=[];i.forEach(p=>{let y=p.combatDetails.combatStats.threat;h+=y,m.push({player:p,rangeStart:h-y,rangeEnd:h})});let f=Math.random()*h;n=m.find(p=>f>=p.rangeStart&&f<p.rangeEnd).player,s.push(n.hrid)}if(i.length<=0)break;let l=A.processAttack(t,n,a);if(this.zone?.isDungeon&&n.isPlayer&&l.didHit&&l.damageDone>0){let h=this.generateCombatLog(t,e.hrid,n,l);this.addToWipeLogs(h)}if(l.hpDrain>0&&this.simResult.addHitpointsGained(t,e.hrid,l.hpDrain),l.didHit&&a.buffs)for(let h of a.buffs){n.addBuff(h,this.simulationTime);let m=new j(this.simulationTime+h.duration,n);this.eventQueue.addEvent(m)}if(a.damageOverTimeRatio>0&&l.damageDone>0){let h=new at(this.simulationTime+ye,t,n,l.damageDone*a.damageOverTimeRatio,a.damageOverTimeDuration/ye,1,a.combatStyleHrid);this.eventQueue.addEvent(h)}if(l.didHit&&a.stunChance>0&&Math.random()<a.stunChance*100/(100+n.combatDetails.combatStats.tenacity)){n.isStunned=!0,n.stunExpireTime=this.simulationTime+a.stunDuration,this.eventQueue.clearMatching(m=>(m.type==k.type||m.type==M.type||m.type==ot.type)&&m.source==n);let h=new ot(n.stunExpireTime,n);this.eventQueue.addEvent(h)}if(l.didHit&&a.blindChance>0&&Math.random()<a.blindChance*100/(100+n.combatDetails.combatStats.tenacity)){n.isBlinded=!0,n.blindExpireTime=this.simulationTime+a.blindDuration,this.eventQueue.clearMatching(m=>m.type==lt.type&&m.source==n),this.eventQueue.clearMatching(m=>m.type==k.type&&m.source==n)&&this.addNextAttackEvent(n);let h=new lt(n.blindExpireTime,n);this.eventQueue.addEvent(h)}if(l.didHit&&a.silenceChance>0&&Math.random()<a.silenceChance*100/(100+n.combatDetails.combatStats.tenacity)){n.isSilenced=!0,n.silenceExpireTime=this.simulationTime+a.silenceDuration,this.eventQueue.clearMatching(m=>m.type==ct.type&&m.source==n),this.eventQueue.clearMatching(m=>m.type==M.type&&m.source==n)&&this.addNextAttackEvent(n);let h=new ct(n.silenceExpireTime,n);this.eventQueue.addEvent(h)}if(l.didHit&&t.combatDetails.combatStats.curse>0){let m=this.eventQueue.getMatching(b=>b.type==P.type&&b.source==n),f=0;m&&(f=m.curseAmount),this.eventQueue.clearMatching(b=>b.type==P.type&&b.source==n);let p=new P(this.simulationTime+15e9,f,n),y={uniqueHrid:"/buff_uniques/curse",typeHrid:"/buff_types/damage_taken",ratioBoost:0,ratioBoostLevelBonus:0,flatBoost:t.combatDetails.combatStats.curse*p.curseAmount,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:15e9};n.addBuff(y,this.simulationTime),this.eventQueue.addEvent(p)}if(t.combatDetails.combatStats.fury>0){let h=this.eventQueue.getMatching(T=>T.type==q.type&&T.source==t);this.eventQueue.clearMatching(T=>T.type==q.type&&T.source==t);let m=15e9,f=5,p=0;h&&(p=h.furyAmount),l.didHit?p=Math.min(p+1,f):p=p/2;let y={uniqueHrid:"/buff_uniques/fury_accuracy",typeHrid:"/buff_types/fury_accuracy",ratioBoost:p*t.combatDetails.combatStats.fury,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:m},b={uniqueHrid:"/buff_uniques/fury_damage",typeHrid:"/buff_types/fury_damage",ratioBoost:p*t.combatDetails.combatStats.fury,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:m};if(p>0){let T=new q(this.simulationTime+m,p,t);this.eventQueue.addEvent(T),t.addBuffs([y,b],this.simulationTime)}else t.removeBuffs([y,b])}if(n.combatDetails.combatStats.weaken>0){t.weakenExpireTime=this.simulationTime+15e9;let m=this.eventQueue.getMatching(b=>b.type==N.type&&b.source==t),f=0;m&&(f=m.weakenAmount),this.eventQueue.clearMatching(b=>b.type==N.type&&b.source==t);let p=new N(this.simulationTime+15e9,f,t),y={uniqueHrid:"/buff_uniques/weaken",typeHrid:"/buff_types/damage",ratioBoost:-1*n.combatDetails.combatStats.weaken*p.weakenAmount,ratioBoostLevelBonus:0,flatBoost:0,flatBoostLevelBonus:0,startTime:"0001-01-01T00:00:00Z",duration:15e9};t.addBuff(y,this.simulationTime),this.eventQueue.addEvent(p)}if(this.simResult.addAttack(t,n,e.hrid,l.didHit?l.damageDone:"miss"),l.thornDamageDone>0&&this.simResult.addAttack(n,t,l.thornType,l.thornDamageDone),this.zone?.isDungeon&&l.thornDamageDone>0&&t.isPlayer){let h=this.buildCombatLog(n,l.thornType,t,l.thornDamageDone);this.addToWipeLogs(h)}if(n.combatDetails.combatStats.retaliation>0&&this.simResult.addAttack(n,t,"retaliation",l.retaliationDamageDone>0?l.retaliationDamageDone:"miss"),this.zone?.isDungeon&&l.retaliationDamageDone>0&&t.isPlayer){let h=this.buildCombatLog(n,"retaliation",t,l.retaliationDamageDone);this.addToWipeLogs(h)}if(n.combatDetails.currentHitpoints==0&&(this.eventQueue.clearEventsForUnit(n),this.simResult.addDeath(n),n.isPlayer||this.simResult.updateTimeSpentAlive(n.hrid,!1,this.simulationTime)),l.didHit&&a.pierceChance>Math.random())continue}if(c||a.targetType=="enemy")break}}processAbilityHealEffect(t,e,a){if(a.targetType=="allAllies"){let s=t.isPlayer?this.players:this.enemies;for(let r of s.filter(n=>n&&n.combatDetails.currentHitpoints>0)){let n=A.processHeal(t,a,r);this.simResult.addHitpointsGained(r,e.hrid,n)}return}if(a.targetType=="lowestHpAlly"){let s=t.isPlayer?this.players:this.enemies,r;for(let n of s.filter(c=>c&&c.combatDetails.currentHitpoints>0)){if(!r){r=n;continue}let c=n.combatDetails.currentHitpoints/n.combatDetails.maxHitpoints,l=r.combatDetails.currentHitpoints/r.combatDetails.maxHitpoints;c<l&&(r=n)}if(r){let n=A.processHeal(t,a,r);this.simResult.addHitpointsGained(r,e.hrid,n)}return}if(a.targetType!="self")throw new Error("Unsupported target type for heal ability effect: "+e.hrid);let i=A.processHeal(t,a,t);this.simResult.addHitpointsGained(t,e.hrid,i)}processAbilityReviveEffect(t,e,a){if(a.targetType!="deadAlly")throw new Error("Unsupported target type for revive ability effect: "+e.hrid);let s=(t.isPlayer?this.players:this.enemies).find(r=>r&&r.combatDetails.currentHitpoints<=0);if(s){this.eventQueue.clearMatching(n=>n.type==rt.type&&n.hrid==s.hrid),s.removeExpiredBuffs(this.simulationTime);let r=A.processRevive(t,a,s);this.simResult.addHitpointsGained(s,e.hrid,r),this.addNextAttackEvent(s),t.isPlayer||this.simResult.updateTimeSpentAlive(s.hrid,!0,this.simulationTime)}}processAbilityPromoteEffect(t,e,a){let i=["/monsters/enchanted_rook","/monsters/enchanted_knight","/monsters/enchanted_bishop"],s=Math.floor(Math.random()*i.length);return new z(i[s],t.difficultyTier)}processAbilitySpendHpEffect(t,e,a){if(a.targetType!="self")throw new Error("Unsupported target type for spend hp ability effect: "+e.hrid);let i=A.processSpendHp(t,a);this.simResult.addHitpointsSpent(t,e.hrid,i)}},Ne=De;var Mt=S("itemDetailMap");var ve=class o{constructor(t,e=null){this.hrid=t;let a=Mt[this.hrid];if(!a)throw new Error("No consumable found for hrid: "+this.hrid);if(this.cooldownDuration=a.consumableDetail.cooldownDuration,this.hitpointRestore=a.consumableDetail.hitpointRestore,this.manapointRestore=a.consumableDetail.manapointRestore,this.recoveryDuration=a.consumableDetail.recoveryDuration,this.catagoryHrid=a.categoryHrid,this.buffs=[],a.consumableDetail.buffs)for(let i of a.consumableDetail.buffs){let s=new C(i);this.buffs.push(s)}if(e)this.triggers=e;else{this.triggers=[];for(let i of a.consumableDetail.defaultCombatTriggers){let s=new J(i.dependencyHrid,i.conditionHrid,i.comparatorHrid,i.value);this.triggers.push(s)}}this.lastUsed=Number.MIN_SAFE_INTEGER}static createFromDTO(t){let e=t.triggers.map(i=>J.createFromDTO(i));return new o(t.hrid,e)}shouldTrigger(t,e,a,i,s){if(e.isStunned)return!1;let r;this.catagoryHrid.includes("food")?r=e.combatDetails.combatStats.foodHaste:r=e.combatDetails.combatStats.drinkConcentration;let n=this.cooldownDuration;if(r>0&&(n=n/(1+r)),this.lastUsed+n>t)return!1;if(this.triggers.length==0)return!0;let c=!0;for(let l of this.triggers)l.isActive(e,a,i,s,t)||(c=!1);return c}},Te=ve;var qe=S("enhancementLevelTotalBonusMultiplierTable");var Se=class o{constructor(t,e){this.hrid=t;let a=Mt[this.hrid];if(!a)throw new Error("No equipment found for hrid: "+this.hrid);this.gameItem=a,this.enhancementLevel=e}static createFromDTO(t){return new o(t.hrid,t.enhancementLevel)}getCombatStat(t){let e=qe[this.enhancementLevel];if(this.gameItem.equipmentDetail.combatStats[t]){let a=this.gameItem.equipmentDetail.combatEnhancementBonuses[t]||0;return this.gameItem.equipmentDetail.combatStats[t]+e*a}return 0}getCombatStyle(){return this.gameItem.equipmentDetail.combatStats.combatStyleHrids[0]}getDamageType(){return this.gameItem.equipmentDetail.combatStats.damageType}getPrimaryTraining(){return this.gameItem.equipmentDetail.combatStats.primaryTraining}getFocusTraining(){return this.gameItem.equipmentDetail.combatStats.focusTraining}},Fe=Se;var Qe=S("houseRoomDetailMap");var _e=class{constructor(t,e){this.hrid=t,this.level=e;let a=Qe[this.hrid];if(!a)throw new Error("No house room found for hrid: "+this.hrid);if(this.buffs=[],a.actionBuffs)for(let i of a.actionBuffs){let s=new C(i,e);this.buffs.push(s)}if(a.globalBuffs)for(let i of a.globalBuffs){let s=new C(i,e);this.buffs.push(s)}}},Ue=_e;var ze=S("achievementTierDetailMap");var We=S("achievementDetailMap");var Ae=class{constructor(t){this.achievements=t,this.buffs=[];for(let e of Object.values(ze)){let a=!0,i=Object.values(We).filter(s=>s.tierHrid==e.hrid);for(let s of Object.values(i))if(!this.achievements[s.hrid]||this.achievements[s.hrid]==!1){a=!1;break}if(a){let s=new C(e.buff);this.buffs.push(s)}}}},Ge=Ae;var we=class o extends kt{constructor(){super();u(this,"equipment",{"/equipment_types/head":null,"/equipment_types/body":null,"/equipment_types/legs":null,"/equipment_types/feet":null,"/equipment_types/hands":null,"/equipment_types/main_hand":null,"/equipment_types/two_hand":null,"/equipment_types/off_hand":null,"/equipment_types/pouch":null,"/equipment_types/back":null});this.isPlayer=!0,this.hrid="player"}static createFromDTO(e){let a=new o;a.staminaLevel=e.staminaLevel,a.intelligenceLevel=e.intelligenceLevel,a.attackLevel=e.attackLevel,a.meleeLevel=e.meleeLevel,a.defenseLevel=e.defenseLevel,a.rangedLevel=e.rangedLevel,a.magicLevel=e.magicLevel,a.hrid=e.hrid;for(let[i,s]of Object.entries(e.equipment))a.equipment[i]=s?Fe.createFromDTO(s):null;return a.food=e.food.map(i=>i?Te.createFromDTO(i):null),a.drinks=e.drinks.map(i=>i?Te.createFromDTO(i):null),a.abilities=e.abilities.map(i=>i?U.createFromDTO(i):null),Object.entries(e.houseRooms).forEach(i=>{i[1]>0&&a.houseRooms.push(new Ue(i[0],i[1]))}),a.achievements=new Ge(e.achievements),a.debuffOnLevelGap=e.debuffOnLevelGap,a}updateCombatDetails(){this.equipment["/equipment_types/main_hand"]?(this.combatDetails.combatStats.combatStyleHrid=this.equipment["/equipment_types/main_hand"].getCombatStyle(),this.combatDetails.combatStats.damageType=this.equipment["/equipment_types/main_hand"].getDamageType(),this.combatDetails.combatStats.attackInterval=this.equipment["/equipment_types/main_hand"].getCombatStat("attackInterval"),this.combatDetails.combatStats.primaryTraining=this.equipment["/equipment_types/main_hand"].getPrimaryTraining()):this.equipment["/equipment_types/two_hand"]?(this.combatDetails.combatStats.combatStyleHrid=this.equipment["/equipment_types/two_hand"].getCombatStyle(),this.combatDetails.combatStats.damageType=this.equipment["/equipment_types/two_hand"].getDamageType(),this.combatDetails.combatStats.attackInterval=this.equipment["/equipment_types/two_hand"].getCombatStat("attackInterval"),this.combatDetails.combatStats.primaryTraining=this.equipment["/equipment_types/two_hand"].getPrimaryTraining()):(this.combatDetails.combatStats.combatStyleHrid="/combat_styles/smash",this.combatDetails.combatStats.damageType="/damage_types/physical",this.combatDetails.combatStats.attackInterval=3e9,this.combatDetails.combatStats.primaryTraining="/skills/melee"),this.equipment["/equipment_types/charm"]?this.combatDetails.combatStats.focusTraining=this.equipment["/equipment_types/charm"].getFocusTraining():this.combatDetails.combatStats.focusTraining="",["stabAccuracy","slashAccuracy","smashAccuracy","rangedAccuracy","magicAccuracy","stabDamage","slashDamage","smashDamage","rangedDamage","magicDamage","defensiveDamage","taskDamage","physicalAmplify","waterAmplify","natureAmplify","fireAmplify","healingAmplify","stabEvasion","slashEvasion","smashEvasion","rangedEvasion","magicEvasion","armor","waterResistance","natureResistance","fireResistance","maxHitpoints","maxManapoints","lifeSteal","hpRegenPer10","mpRegenPer10","physicalThorns","elementalThorns","combatDropRate","combatRareFind","combatDropQuantity","combatExperience","criticalRate","criticalDamage","armorPenetration","waterPenetration","naturePenetration","firePenetration","abilityHaste","tenacity","manaLeech","castSpeed","threat","parry","mayhem","pierce","curse","fury","weaken","ripple","bloom","blaze","attackSpeed","foodHaste","drinkConcentration","autoAttackDamage","abilityDamage","staminaExperience","intelligenceExperience","attackExperience","defenseExperience","meleeExperience","rangedExperience","magicExperience","retaliation"].forEach(e=>{this.combatDetails.combatStats[e]=Object.values(this.equipment).filter(a=>a!=null).map(a=>a.getCombatStat(e)).reduce((a,i)=>a+i,0)}),this.equipment["/equipment_types/pouch"]?(this.combatDetails.combatStats.foodSlots=1+this.equipment["/equipment_types/pouch"].getCombatStat("foodSlots"),this.combatDetails.combatStats.drinkSlots=1+this.equipment["/equipment_types/pouch"].getCombatStat("drinkSlots")):(this.combatDetails.combatStats.foodSlots=1,this.combatDetails.combatStats.drinkSlots=1),super.updateCombatDetails()}},Ke=we;var je=S("actionDetailMap");var Ee=class{constructor(t,e){this.hrid=t,this.difficultyTier=e;let a=je[this.hrid];this.monsterSpawnInfo=a.combatZoneInfo.fightInfo,this.dungeonSpawnInfo=a.combatZoneInfo.dungeonInfo,this.encountersKilled=1,this.monsterSpawnInfo.battlesPerBoss=10,this.buffs=a.buffs,this.isDungeon=a.combatZoneInfo.isDungeon,this.dungeonsCompleted=0,this.dungeonsFailed=0,this.finalWave=!1}getRandomEncounter(){if(this.monsterSpawnInfo.bossSpawns&&this.encountersKilled==this.monsterSpawnInfo.battlesPerBoss)return this.encountersKilled=1,this.monsterSpawnInfo.bossSpawns.map(i=>new z(i.combatMonsterHrid,i.difficultyTier+this.difficultyTier));let t=this.monsterSpawnInfo.randomSpawnInfo.spawns.reduce((i,s)=>i+s.rate,0),e=[],a=0;t:for(let i=0;i<this.monsterSpawnInfo.randomSpawnInfo.maxSpawnCount;i++){let s=t*Math.random(),r=0;for(let n of this.monsterSpawnInfo.randomSpawnInfo.spawns)if(r+=n.rate,s<=r){if(a+=n.strength,a<=this.monsterSpawnInfo.randomSpawnInfo.maxTotalStrength)e.push({hrid:n.combatMonsterHrid,difficultyTier:n.difficultyTier});else break t;break}}return this.encountersKilled++,e.map(i=>new z(i.hrid,i.difficultyTier+this.difficultyTier))}failWave(){this.dungeonsFailed++,this.encountersKilled=1}getNextWave(){if(this.encountersKilled>this.dungeonSpawnInfo.maxWaves&&(this.dungeonsCompleted++,this.encountersKilled=1),this.dungeonSpawnInfo.fixedSpawnsMap.hasOwnProperty(this.encountersKilled.toString())){let t=this.dungeonSpawnInfo.fixedSpawnsMap[this.encountersKilled.toString()];return this.encountersKilled++,t.map(e=>new z(e.combatMonsterHrid,e.difficultyTier+this.difficultyTier))}else{let t={},e=Object.keys(this.dungeonSpawnInfo.randomSpawnInfoMap).map(Number).sort((r,n)=>r-n);if(this.encountersKilled>e[e.length-1])t=this.dungeonSpawnInfo.randomSpawnInfoMap[e[e.length-1]];else for(let r=0;r<e.length-1;r++)if(this.encountersKilled>=e[r]&&this.encountersKilled<=e[r+1]){t=this.dungeonSpawnInfo.randomSpawnInfoMap[e[r]];break}let a=t.spawns.reduce((r,n)=>r+n.rate,0),i=[],s=0;t:for(let r=0;r<t.maxSpawnCount;r++){let n=a*Math.random(),c=0;for(let l of t.spawns)if(c+=l.rate,n<=c){if(s+=l.strength,s<=t.maxTotalStrength)i.push({hrid:l.combatMonsterHrid,difficultyTier:l.difficultyTier});else break t;break}}return this.encountersKilled++,i.map(r=>new z(r.hrid,r.difficultyTier+this.difficultyTier))}}},Ve=Ee;var Ze=36e11;function ca(o){let t=o|0;return function(){t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Re(o,t){let e={};for(let[a,i]of Object.entries(o||{}))e[a]=i/t;return e}async function Ye(o){let t=Math.random;Math.random=ca(o.seed);try{let e=new Ve(o.zoneHrid,o.tier),a=Ke.createFromDTO(structuredClone(o.player));a.zoneBuffs=e.buffs||[],a.extraBuffs=o.extraBuffs||[];let s=await new Ne([a],e,null,{}).simulate(o.hours*Ze),r=s.simulatedTime/Ze,n={};for(let[l,h]of Object.entries(s.deaths))l!=="player1"&&(n[l]=h/r);let c=Re(s.experienceGained.player1,r);return{hours:r,xp:c,xpTotal:Object.values(c).reduce((l,h)=>l+h,0),deaths:(s.deaths.player1||0)/r,encounters:s.encounters/r,kills:n,consumables:Re(s.consumablesUsed.player1,r),manaUsed:Re(s.manaUsed?.player1,r),dropRateMultiplier:s.dropRateMultiplier.player1??1,rareFindMultiplier:s.rareFindMultiplier.player1??1,combatDropQuantity:s.combatDropQuantity.player1??0}}finally{Math.random=t}}self.onmessage=async o=>{let t=o.data;if(t.type==="init"){ke(t.data),self.postMessage({type:"ready"});return}if(t.type==="sim")try{let e=await Ye(t.job);self.postMessage({type:"result",id:t.id,result:e})}catch(e){self.postMessage({type:"error",id:t.id,error:String(e?.stack||e)})}};})();\n';

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
      "market_item_order_books_updated"
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
    const book = payload.orderBooks?.[0] ?? payload.orderBooks?.["0"];
    if (!payload.itemHrid || !book) return;
    state.orderBooks.set(payload.itemHrid, {
      at: Date.now(),
      asks: (book.asks || []).map(normalizeOrder).filter((o) => o.quantity > 0),
      bids: (book.bids || []).map(normalizeOrder).filter((o) => o.quantity > 0)
    });
    saveOrderBooks();
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
    orderBooks: loadOrderBooks(),
    // itemHrid -> { at, asks, bids } for enhancement level 0, from viewing it on the market
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
  function applyItems(updates) {
    for (const item of updates || []) {
      if (!item) continue;
      const key = itemKey(item);
      if (item.count === 0) state.items.delete(key);
      else state.items.set(key, item.hash ? item : { ...state.items.get(key) || {}, ...item });
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
      const skill = skills.find((s) => s.skillHrid === updated.skillHrid);
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
    if (data.type === "init_character_data") {
      state.character = data;
      state.items = /* @__PURE__ */ new Map();
      applyItems(data.characterItems);
    } else if (data.type === "market_item_order_books_updated") {
      applyOrderBook(data);
    } else if (!state.character) {
      return;
    } else {
      switch (data.type) {
        case "items_updated":
          applyItems(data.endCharacterItems);
          break;
        case "action_completed":
          applyItems(data.endCharacterItems);
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
        case "actions_updated":
          mergeActions(data.endCharacterActions);
          break;
        case "achievements_updated":
          copyFields(data, ["characterAchievements"]);
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
        listener(data.type, data);
      } catch (error) {
        console.error("[Combat Advisor]", error);
      }
    }
  }
  function onMessage(event) {
    const raw = event.data;
    if (typeof raw !== "string" || !INTERESTING.test(raw)) return;
    try {
      handle(JSON.parse(raw));
    } catch (error) {
      console.error("[Combat Advisor] Could not parse message", error);
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
      console.warn("[Combat Advisor] localStorageUtil failed", error);
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
        console.warn("[Combat Advisor] Could not fetch", table, error);
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
        console.error("[Combat Advisor]", error);
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
    return Object.entries(prices?.[itemHrid] || {}).filter(([, entry]) => entry.a > 0).map(([level, entry]) => ({ enhancementLevel: Number(level), price: entry.a })).sort((a, b) => a.price - b.price);
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
      const rate = Math.min(1, (1 + 0.1 * tier) * (drop.dropRate + (drop.dropRatePerDifficultyTier ?? 0) * tier));
      if (rate <= 0) continue;
      const finalRate = Math.min(1, rate * (sim.dropRateMultiplier || 1));
      value += finalRate * ((drop.minCount + drop.maxCount) / 2) * quantity * sellValue(drop.itemHrid);
    }
    for (const drop of monster.rareDropTable || []) {
      if (drop.minDifficultyTier > tier) continue;
      const finalRate = drop.dropRate * (sim.rareFindMultiplier || 1);
      value += finalRate * ((drop.minCount + drop.maxCount) / 2) * quantity * sellValue(drop.itemHrid);
    }
    return value;
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
    let h2 = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < tiny) d = tiny;
      c2 = 1 + aa / c2;
      if (Math.abs(c2) < tiny) c2 = tiny;
      d = 1 / d;
      h2 *= d * c2;
      aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
      d = 1 + aa * d;
      if (Math.abs(d) < tiny) d = tiny;
      c2 = 1 + aa / c2;
      if (Math.abs(c2) < tiny) c2 = tiny;
      d = 1 / d;
      const delta = d * c2;
      h2 *= delta;
      if (Math.abs(delta - 1) < 3e-12) break;
    }
    return h2;
  }
  function incompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? front * betaContinuedFraction(a, b, x) / a : 1 - front * betaContinuedFraction(b, a, 1 - x) / b;
  }
  function studentTCdf(t3, df) {
    const tail = 0.5 * incompleteBeta(df / (df + t3 * t3), df / 2, 0.5);
    return t3 > 0 ? 1 - tail : tail;
  }
  function confidenceGreater(a, b) {
    const stats = (x) => {
      const mean = x.reduce((s, v) => s + v, 0) / x.length;
      return { n: x.length, mean, variance: x.reduce((s, v) => s + (v - mean) ** 2, 0) / (x.length - 1) };
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
  var INVENTORY = "/item_locations/inventory";
  var COMBAT = "/action_types/combat";
  function emptyTriggers(list) {
    return (list || []).map((t3) => ({
      dependencyHrid: t3.dependencyHrid,
      conditionHrid: t3.conditionHrid,
      comparatorHrid: t3.comparatorHrid,
      value: t3.value ?? 0
    }));
  }
  function combatLevel(levels) {
    const { stamina, intelligence, attack, melee, defense, ranged, magic } = levels;
    return 0.1 * (stamina + intelligence + attack + defense + Math.max(melee, ranged, magic)) + 0.5 * Math.max(attack, defense, melee, ranged, magic);
  }
  function buildProfile(character, items, data) {
    const allLevels = {};
    for (const skill of character.characterSkills || []) allLevels[skill.skillHrid] = skill.level;
    const levels = {};
    for (const skill of COMBAT_SKILLS) levels[skill] = allLevels["/skills/" + skill] ?? 1;
    const totalLevel = allLevels["/skills/total_level"] ?? Object.entries(allLevels).filter(([hrid]) => hrid !== "/skills/total_level").reduce((sum, [, level]) => sum + level, 0);
    const equipment = {};
    const inventory = [];
    for (const item of items.values()) {
      if (!item.itemHrid) continue;
      if (item.itemLocationHrid === INVENTORY) {
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
      abilities: profile.abilities.map(ability),
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
  var NON_MAGIC_STATS = /* @__PURE__ */ new Set([
    "stabAccuracy",
    "slashAccuracy",
    "smashAccuracy",
    "rangedAccuracy",
    "stabDamage",
    "slashDamage",
    "smashDamage",
    "rangedDamage",
    "meleeExperience",
    "rangedExperience",
    "defensiveDamage",
    "physicalAmplify",
    "armorPenetration"
  ]);
  var MIN_GOLD_REF = 1e3;
  function xpValue(result) {
    return result.xpTotal;
  }
  function makeGoal(settings, reference) {
    return {
      gold: Math.min(1, Math.max(0, Number(settings.goldWeight) || 0)),
      xpRef: Math.max(1, reference.xp),
      goldRef: Math.max(MIN_GOLD_REF, reference.gold)
    };
  }
  function score(result, goal) {
    return (1 - goal.gold) * xpValue(result) / goal.xpRef + goal.gold * result.profit / goal.goldRef;
  }
  var RARE_DEATHS_PER_HOUR = 0.5;
  function deathLimit(settings) {
    return settings.acceptRareDeaths ? RARE_DEATHS_PER_HOUR : 0;
  }
  var acceptable = (result, settings) => result.deaths <= deathLimit(settings);
  function zoneGoal(zoneResults, settings) {
    const safe = zoneResults.filter((z) => acceptable(z.result, settings));
    const pool = safe.length ? safe : zoneResults;
    return makeGoal(settings, {
      xp: Math.max(...pool.map((z) => xpValue(z.result))),
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
    const n2 = results.length;
    const mean = (pick) => results.reduce((sum, r) => sum + pick(r), 0) / n2;
    const meanMap = (pick) => {
      const out = {};
      for (const r of results) for (const [k, v] of Object.entries(pick(r))) out[k] = (out[k] || 0) + v / n2;
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
  function enrich(result, tier) {
    const loot = lootValue(result, tier);
    const cost = consumableCost(result);
    return { ...result, loot, cost, profit: loot - cost, killsTotal: Object.values(result.kills).reduce((a, b) => a + b, 0) };
  }
  async function simulateRuns(pool, items, zone, hours, onProgress) {
    const data = getClientData();
    const jobs = [];
    for (const item of items) {
      const player = toDTO(item.profile, data);
      for (const seed of item.seeds) {
        jobs.push({ player, zoneHrid: zone.zoneHrid, tier: zone.tier, hours, seed: seedFor(seed), extraBuffs: item.profile.extraBuffs });
      }
    }
    const results = await pool.runAll(jobs, onProgress);
    let next = 0;
    return items.map((item) => item.seeds.map((seed) => ({ ...enrich(results[next++], zone.tier), seed })));
  }
  var summarize = (runs, tier) => enrich(average(runs), tier);
  async function simulateVariants(pool, variants, zone, settings, onProgress) {
    const seeds = Array.from({ length: settings.seeds }, (_, i) => i);
    const runs = await simulateRuns(pool, variants.map((v) => ({ profile: v.profile, seeds })), zone, settings.hours, onProgress);
    return variants.map((variant, i) => ({ ...variant, result: summarize(runs[i], zone.tier), runs: runs[i] }));
  }
  async function analyzeZones(pool, profile, settings, onProgress) {
    const variants = [];
    for (const zone of combatZones()) {
      for (let tier = 0; tier <= Math.min(settings.maxTier, zone.maxDifficulty ?? 0); tier++) {
        variants.push({ zone: { zoneHrid: zone.hrid, tier } });
      }
    }
    const data = getClientData();
    const player = toDTO(profile, data);
    const hours = Math.max(1, settings.hours / 2);
    const jobs = variants.map((v) => ({ player, zoneHrid: v.zone.zoneHrid, tier: v.zone.tier, hours, seed: seedFor(0), extraBuffs: profile.extraBuffs }));
    const results = await pool.runAll(jobs, onProgress);
    return variants.map((v, i) => ({ ...v, result: enrich(results[i], v.zone.tier) }));
  }
  function pickBestZone(zoneResults, settings) {
    if (!zoneResults?.length) return null;
    const goal = zoneGoal(zoneResults, settings);
    const sorted = [...zoneResults].sort((a, b) => score(b.result, goal) - score(a.result, goal));
    return sorted.find((z) => acceptable(z.result, settings)) || sorted[0];
  }
  function isUsefulForMage(stats) {
    return Object.entries(stats || {}).some(([key, value]) => typeof value === "number" && value > 0 && !NON_MAGIC_STATS.has(key) && key !== "attackInterval");
  }
  function gearCandidates(profile, budget) {
    const data = getClientData();
    const candidates = [];
    for (const item of Object.values(data.itemDetailMap)) {
      const detail = item.equipmentDetail;
      if (!detail) continue;
      const type = detail.type?.split("/").pop();
      if (!GEAR_TYPES.includes(type)) continue;
      if (!meetsRequirements(profile, detail.levelRequirements)) continue;
      const stats = detail.combatStats || {};
      if (type === "main_hand" || type === "two_hand") {
        if (!(stats.combatStyleHrids || []).includes("/combat_styles/magic")) continue;
      } else if (!isUsefulForMage(stats)) {
        continue;
      }
      if (type === "off_hand" && profile.equipment.two_hand) continue;
      const current = profile.equipment[type];
      let options = gearOptions(profile, item.hrid, budget);
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
          cost: option.cost,
          owned: option.owned,
          replaces: current || null,
          profile: variant
        };
        candidates.push(candidate);
        const foodSlotsNow = slotCounts(profile, data).food;
        if (type === "pouch" && slotCounts(variant, data).food > foodSlotsNow) {
          for (const food of combatConsumables("food")) {
            if (profile.food.includes(food)) continue;
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
  function gearOptions(profile, hrid, budget) {
    const owned = profile.inventory.filter((i) => i.hrid === hrid).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
    const options = owned ? [{ enhancementLevel: owned.enhancementLevel, cost: 0, owned: true }] : [];
    const front = [];
    for (const listing of marketListings(hrid)) {
      if (listing.price > budget || owned && listing.enhancementLevel <= owned.enhancementLevel) continue;
      if (front.length && listing.enhancementLevel <= front[front.length - 1].enhancementLevel) continue;
      front.push(listing);
    }
    let picked = front;
    if (front.length > MAX_LEVELS) {
      const step = (front.length - 1) / (MAX_LEVELS - 1);
      picked = Array.from({ length: MAX_LEVELS }, (_, i) => front[Math.round(i * step)]);
    }
    for (const listing of picked) options.push({ enhancementLevel: listing.enhancementLevel, cost: listing.price, owned: false });
    return options;
  }
  function combatConsumables(kind) {
    const category = kind === "food" ? "/item_categories/food" : "/item_categories/drink";
    return Object.values(getClientData().itemDetailMap).filter((item) => item.categoryHrid === category && item.consumableDetail?.usableInActionTypeMap?.["/action_types/combat"]).filter((item) => askPrice(item.hrid, 0) !== null).map((item) => item.hrid);
  }
  function abilityCandidates(profile, budget) {
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
    const placements = empty.length ? [empty[0]] : indices;
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
        const count2 = Math.max(1, Math.ceil((table[target] - xpNow) / xpPerBook));
        if (count2 * price > budget) break;
        const variant = cloneProfile(profile);
        variant.abilities[index] = { hrid: entry.hrid, level: target };
        candidates.push({
          kind: "abilityLevel",
          slot: "ability" + index,
          hrid: entry.hrid,
          bookHrid: book.hrid,
          fromLevel: entry.level,
          level: target,
          books: count2,
          cost: count2 * price,
          owned: false,
          replaces: null,
          profile: variant
        });
      }
    });
    return candidates;
  }
  function consumableCandidates(profile, kind) {
    const data = getClientData();
    const slots = slotCounts(profile, data);
    const count2 = kind === "food" ? slots.food : slots.drinks;
    const current = (kind === "food" ? profile.food : profile.drinks).slice(0, count2);
    while (current.length < count2) current.push(null);
    const empty = current.findIndex((h2) => !h2);
    const placements = empty !== -1 ? [empty] : current.map((_, i) => i);
    const candidates = [];
    for (const hrid of combatConsumables(kind)) {
      if (current.includes(hrid)) continue;
      for (const index of placements) {
        const variant = cloneProfile(profile);
        const list = kind === "food" ? variant.food : variant.drinks;
        while (list.length < count2) list.push(null);
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
  function bestPerItem(evaluated) {
    const groups = /* @__PURE__ */ new Map();
    for (const c2 of evaluated) {
      const key = [c2.kind, c2.hrid, c2.enhancementLevel ?? "", c2.kind === "abilityLevel" ? c2.level : "", c2.remove ? "remove" : ""].join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c2);
    }
    return [...groups.values()].map((options) => {
      const pool = options.some((c2) => c2.safe) ? options.filter((c2) => c2.safe) : options;
      const top = pool.reduce((a, b) => b.delta > a.delta ? b : a);
      if (!top.extraFood || top.delta <= 0) return top;
      return pool.filter((c2) => c2.delta >= 0.85 * top.delta).sort((a, b) => a.costPerHourDelta - b.costPerHourDelta)[0];
    });
  }
  async function analyzeUpgrades(pool, profile, zone, settings, onProgress, onRefineProgress) {
    const budget = settings.budget;
    const candidates = [
      ...gearCandidates(profile, budget),
      ...abilityCandidates(profile, budget),
      ...consumableCandidates(profile, "drinks"),
      ...consumableCandidates(profile, "food")
    ].map((c2, id) => ({ ...c2, id }));
    const seeds = (n2) => Array.from({ length: n2 }, (_, i) => i);
    const items = [{ profile, seeds: seeds(settings.seeds * BASE_SEED_FACTOR) }, ...candidates.map((c2) => ({ profile: c2.profile, seeds: seeds(settings.seeds) }))];
    const runs = await simulateRuns(pool, items, zone, settings.hours, onProgress);
    const simulated = [{ profile }, ...candidates].map((v, i) => ({ ...v, result: summarize(runs[i], zone.tier), runs: runs[i] }));
    const slots = slotCounts(profile, getClientData());
    const emptyAbilitySlots = [];
    for (let i = 1; i <= slots.abilities; i++) if (!profile.abilities[i]) emptyAbilitySlots.push(i);
    const raw = {
      zone,
      hours: settings.hours,
      seedsPerRound: settings.seeds,
      emptyAbilitySlots,
      baseProfile: profile,
      base: simulated[0].result,
      baseRuns: simulated[0].runs,
      candidates: simulated.slice(1)
    };
    for (let round = 0; round < 2; round++) {
      if (!await refineUncertain(pool, raw, settings, onRefineProgress)) break;
    }
    return raw;
  }
  function uncertainCandidates(raw, settings) {
    const rated = rateUpgrades(raw, settings);
    const maxRuns = raw.seedsPerRound * MAX_SEED_FACTOR;
    return [...rated.gear, ...rated.abilities, ...rated.drinks, ...rated.food].filter((c2) => c2.delta > 0 && c2.safe && c2.confidence < REFINE_BELOW && c2.runs.length < maxRuns).sort((a, b) => b.delta - a.delta).slice(0, MAX_REFINED);
  }
  async function refineUncertain(pool, raw, settings, onProgress) {
    const targets = uncertainCandidates(raw, settings).map((c2) => raw.candidates.find((x) => x.id === c2.id));
    if (!targets.length) return 0;
    const items = targets.map((c2) => {
      const first = Math.max(...c2.runs.map((r) => r.seed)) + 1;
      return { profile: c2.profile, seeds: Array.from({ length: raw.seedsPerRound }, (_, i) => first + i) };
    });
    const runs = await simulateRuns(pool, items, raw.zone, raw.hours, onProgress);
    targets.forEach((c2, i) => {
      c2.runs = [...c2.runs, ...runs[i]];
      c2.result = summarize(c2.runs, raw.zone.tier);
    });
    return targets.length;
  }
  function rateUpgrades(raw, settings) {
    const { base } = raw;
    const goal = makeGoal(settings, { xp: xpValue(base), gold: base.loot });
    const baseScore = score(base, goal);
    const baseScores = raw.baseRuns.map((r) => score(r, goal));
    const used = (c2) => c2.remove || !["food", "drinks"].includes(c2.kind) || (c2.result.consumables[c2.hrid] || 0) > 0.01;
    const evaluated = raw.candidates.filter(used).map((c2) => {
      const delta = score(c2.result, goal) - baseScore;
      const confidence = confidenceGreater(c2.runs.map((r) => score(r, goal)), baseScores) ?? 0.5;
      return {
        ...c2,
        delta,
        deltaPct: delta,
        // scores are already fractions of the reference
        confidence,
        significant: confidence >= CONFIDENCE_LEVEL,
        xpDelta: xpValue(c2.result) - xpValue(base),
        profitDelta: c2.result.profit - base.profit,
        // A change that makes you die noticeably more often is never recommended, whatever the
        // gain – unless you accept rare deaths and it stays within that limit.
        safe: c2.result.deaths <= Math.max(base.deaths * 1.1 + 0.3, deathLimit(settings)),
        costPerHourDelta: c2.result.cost - base.cost,
        deathsDelta: c2.result.deaths - base.deaths
      };
    });
    const best = bestPerItem(evaluated);
    const byDelta = (a, b) => b.delta - a.delta;
    return {
      ...raw,
      goal,
      baseScore,
      gear: best.filter((c2) => c2.kind === "gear").sort(byDelta),
      abilities: best.filter((c2) => c2.kind === "ability" || c2.kind === "abilityLevel").sort(byDelta),
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
    for (const p of points) {
      const last = rising[rising.length - 1];
      if (last && (p.cost === last.cost || p.delta <= last.delta)) continue;
      rising.push(p);
    }
    const slope = (a, b) => (b.delta - a.delta) / (b.cost - a.cost);
    const hull = [];
    for (const p of rising) {
      while (hull.length >= 2 && slope(hull[hull.length - 2], hull[hull.length - 1]) <= slope(hull[hull.length - 1], p)) hull.pop();
      hull.push(p);
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
    const minGain = 0.01;
    const minEfficiency = (SPENDING[spending] || SPENDING.balanced).minPctPerMillion / 100 / 1e6;
    const usable = (c2) => c2.significant && c2.safe && c2.delta > 0;
    const groups = /* @__PURE__ */ new Map();
    for (const c2 of analysis.gear.filter(usable)) {
      const key = c2.slot === "main_hand" || c2.slot === "two_hand" ? "weapon" : c2.slot;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c2);
    }
    for (const c2 of analysis.abilities.filter(usable)) {
      const key = c2.kind === "abilityLevel" || c2.replaces ? c2.slot : "new-ability:" + c2.hrid;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c2);
    }
    const confident = (from, to) => stepConfidence(analysis, from, to) >= CONFIDENCE_LEVEL;
    const steps = [...groups.entries()].flatMap(([key, options]) => hullSteps(key, options, minGain, minEfficiency, confident));
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
    if (picks.some((p) => p.slot === "two_hand")) picks = picks.filter((p) => p.slot !== "off_hand");
    spent = picks.reduce((sum, p) => sum + p.cost, 0);
    const drink = pickConsumable(analysis.drinks, analysis.goal.gold);
    const food = pickConsumable(analysis.food, analysis.goal.gold);
    if (food.value && picks.some((p) => p.extraFood === food.value.hrid)) food.value = null;
    return { picks, spent, drink: drink.value, drinkMax: drink.max, food: food.value, foodMax: food.max };
  }
  function putConsumable(list, slot, hrid) {
    const index = Number(slot.replace(/\D+/g, ""));
    while (list.length <= index) list.push(null);
    list[index] = hrid;
  }
  function applyPlan(profile, plan) {
    const result = cloneProfile(profile);
    for (const pick of plan.picks) {
      if (pick.kind === "gear") {
        equip(result, pick.slot, { hrid: pick.hrid, enhancementLevel: pick.enhancementLevel });
        if (pick.extraFood) putConsumable(result.food, "food" + pick.extraFoodSlot, pick.extraFood);
      } else if (pick.kind === "ability" || pick.kind === "abilityLevel") {
        result.abilities[Number(pick.slot.replace("ability", ""))] = { hrid: pick.hrid, level: pick.level };
      }
    }
    for (const pick of [plan.drink, plan.food]) {
      if (pick) putConsumable(pick.kind === "food" ? result.food : result.drinks, pick.slot, pick.remove ? null : pick.hrid);
    }
    return result;
  }
  async function verifyPlan(pool, profile, plan, zone, settings, onProgress) {
    const variants = [{ kind: "base", profile }, { kind: "plan", profile: applyPlan(profile, plan) }];
    const [base, planned] = await simulateVariants(pool, variants, zone, settings, onProgress);
    return { base: base.result, planned: planned.result };
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
      const ready = [];
      for (let i = 0; i < this.size; i++) {
        const worker = new Worker(this.url);
        const entry = { worker, busy: true };
        ready.push(
          new Promise((resolve2, reject) => {
            worker.onmessage = (event) => {
              if (event.data.type === "ready") {
                worker.onmessage = (e) => this.onResult(entry, e.data);
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
      await Promise.all(ready);
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
  padding: 6px 12px; border-radius: 16px; border: 1px solid #5b6bb0;
  background: #262c4a; color: #e8ebff; font: 600 13px/1.2 sans-serif; cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,.4); touch-action: none; user-select: none; -webkit-user-select: none;
}
.mwia-launcher:hover { background: #333b63; }
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
.mwia-history-table { border-collapse: collapse; width: 100%; margin: 4px 0; font-variant-numeric: tabular-nums; }
.mwia-history-table th, .mwia-history-table td { padding: 1px 4px; text-align: right; font-weight: 400; white-space: nowrap; }
.mwia-history-table th:first-child { text-align: left; color: #9aa3cf; }
.mwia-history-table tr:first-child th { color: #8189b0; font-size: 11px; }
.mwia-history-high { color: #ff9b7b; }
.mwia-history-low { color: #7ee2b0; }
.mwia-history-chart { display: block; width: 100%; height: 64px; }
.mwia-history-chart polyline { fill: none; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
polyline.mwia-history-ask { stroke: #f2a65b; }
polyline.mwia-history-bid { stroke: #7ee2b0; }
.mwia-history-scale { display: flex; justify-content: space-between; }
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
.mwia-guide-box, .mwia-tool-box { box-sizing: border-box; width: 100%; height: auto; flex: 0 0 auto; align-self: stretch; grid-column: 1 / -1; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; margin: 6px 0; padding: 6px 10px; border: 1px solid #3c4677; border-radius: 6px; background: #1d2440; color: #dde2ff; font: 400 12px/1.4 sans-serif; text-align: left; }
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
.mwia-tool-box { margin: 10px 0; }
.mwia-tool-list { list-style: none; margin: 4px 0; padding: 0; }
.mwia-tool-list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 0; border-top: 1px solid #2a3150; }
.mwia-tool-list li .mwia-guide-cart { margin-top: 0; flex: 0 0 auto; }
.mwia-train-target { outline: 3px solid #ffd257 !important; outline-offset: 2px; border-radius: 4px; }
.mwia-narrow-only { display: none; }
.mwia-tip-pop {
  position: fixed; z-index: 2000; max-width: min(300px, calc(100vw - 16px)); padding: 6px 9px; border-radius: 6px;
  background: #0f1222; color: #e8ebff; border: 1px solid #5b6bb0; box-shadow: 0 4px 16px rgba(0,0,0,.6); font: 12px/1.4 sans-serif;
}

/* Touch screens: bigger targets, and 16px inputs so iOS doesn't zoom in on focus. */
@media (hover: none), (pointer: coarse) {
  .mwia-panel button, .mwia-train button, .mwia-train-start { touch-action: manipulation; }
  .mwia-launcher { padding: 9px 14px; font-size: 14px; }
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
  function coinsInput(n2) {
    if (n2 >= 1e9 && n2 % 1e7 === 0) return n2 / 1e9 + "B";
    if (n2 >= 1e6 && n2 % 1e4 === 0) return n2 / 1e6 + "M";
    if (n2 >= 1e3 && n2 % 10 === 0) return n2 / 1e3 + "k";
    return String(n2);
  }
  function shortCoins(n2) {
    const abs = Math.abs(n2);
    const fixed = (value, digits) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (abs >= 1e9) return fixed(n2 / 1e9, 2) + "B";
    if (abs >= 1e6) return fixed(n2 / 1e6, abs >= 1e7 ? 1 : 2) + "M";
    if (abs >= 1e4) return fixed(n2 / 1e3, abs >= 1e5 ? 0 : 1) + "k";
    return Math.round(n2).toLocaleString("en-US");
  }
  var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c2) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c2]);

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
  async function whenReady(api) {
    const start = Date.now();
    while (!api.ready && Date.now() - start < READY_TIMEOUT_MS) {
      await new Promise((resolve2) => setTimeout(resolve2, 100));
    }
  }
  async function addToCart(win2, items) {
    const api = shoppingApi(win2);
    if (!api) {
      throw new Error("MWITools' shopping cart was not found. Check that MWITools is installed, enabled and up to date, then reload the game.");
    }
    await whenReady(api);
    const outcome = { added: [], updated: [], present: [], failed: [] };
    for (const item of items) {
      const enhancementLevel = item.enhancementLevel || 0;
      const wanted = Math.max(1, Math.ceil(item.quantity));
      const label = { hrid: item.hrid, enhancementLevel };
      try {
        const have3 = api.getCartItem(item.hrid, enhancementLevel)?.quantity || 0;
        if (have3 >= wanted) {
          outcome.present.push(label);
          continue;
        }
        const result = api.addToCart([{ itemHrid: item.hrid, enhancementLevel, quantity: wanted - have3, source: "manual" }]);
        if (result?.ok) (have3 ? outcome.updated : outcome.added).push(label);
        else outcome.failed.push(label);
      } catch {
        outcome.failed.push(label);
      }
    }
    return outcome;
  }

  // src/skilling.js
  var SKILLING_SKILLS = ["milking", "foraging", "woodcutting", "cheesesmithing", "crafting", "tailoring", "cooking", "brewing"];
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
  var MIN_CYCLE_SECONDS = 3;
  var NEAR_LEVELS = 10;
  var HOURS_PER_DAY = 24;
  var WIDE_SPREAD = 1.5;
  var INVENTORY2 = "/item_locations/inventory";
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
    const known = BUFF_SOURCES.filter((key) => character[key]);
    let buffs = null;
    if (known.length) {
      buffs = {};
      for (const key of known) {
        for (const [type, list] of Object.entries(character[key] || {})) {
          if (Array.isArray(list)) (buffs[type] || (buffs[type] = [])).push(...list);
        }
      }
    }
    const drinks = {};
    const slots = {};
    const pouch = [...items.values()].find((item) => item.itemLocationHrid === POUCH && item.itemHrid)?.itemHrid || null;
    const pouchSlots = drinkSlots(pouch, data);
    for (const skill of SKILLING_SKILLS) {
      const list = character.actionTypeDrinkSlotsMap?.[skillType(skill)];
      drinks[skillType(skill)] = (list || []).map((slot) => slot?.itemHrid).filter(Boolean);
      slots[skillType(skill)] = Math.max(pouchSlots, drinks[skillType(skill)].length);
    }
    return { levels, experience, buffs, drinks, slots, pouch, concentration: drinkConcentration(character, items, data) };
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
      if (!item.itemHrid || item.itemLocationHrid === INVENTORY2) continue;
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
  function usableTeas(data, type) {
    return Object.values(data.itemDetailMap).filter((item) => item.consumableDetail?.usableInActionTypeMap?.[type] && item.consumableDetail.buffs?.length && !item.consumableDetail.usableInActionTypeMap["/action_types/combat"]).map((item) => item.hrid);
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
  function marketPricer(entryOf, data, sellAt = "ask", usualAsk = () => null) {
    const cache = /* @__PURE__ */ new Map();
    const contents = (hrid) => (data.openableLootDropMap?.[hrid] || []).reduce((sum, drop) => sum + meanCount(drop) * (drop.itemHrid === hrid ? 0 : this_.sell(drop.itemHrid).price), 0);
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
        if (result.source === "bag") result.price /= 10;
        cache.set(hrid, result);
        return result;
      }
    };
    return this_;
  }
  var meanCount = (drop) => (Number(drop.dropRate ?? 1) || 0) * ((Number(drop.minCount ?? 1) + Number(drop.maxCount ?? 1)) / 2);
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
    const cycleSeconds = Math.max(MIN_CYCLE_SECONDS, baseSeconds / (1 + speed));
    const actionsPerHour = 3600 / cycleSeconds * (1 + efficiency);
    const quantity = Math.max(0, fraction(BUFF.gathering) + fraction(BUFF.gourmet));
    const processing = Math.min(1, Math.max(0, fraction(BUFF.processing)));
    const artisan = Math.min(1, Math.max(0, fraction(BUFF.artisan)));
    const products = processing > 0 ? processedProducts(data) : null;
    const outputs = [];
    const addOutput = (itemHrid, count2, kind) => {
      if (count2 <= 0) return;
      const sell = market.sell(itemHrid);
      outputs.push({ itemHrid, count: count2, kind, price: sell.price, sell, value: count2 * sell.price });
    };
    const base = action.outputItems?.length ? action.outputItems.map((o) => ({ itemHrid: o.itemHrid, count: o.count })) : (action.dropTable || []).map((d) => ({ itemHrid: d.itemHrid, count: meanCount(d) }));
    for (const output of base) {
      const count2 = output.count * (1 + quantity);
      const processed = products?.get(output.itemHrid);
      addOutput(output.itemHrid, processed ? count2 * (1 - processing) : count2, "product");
      if (processed) addOutput(processed.itemHrid, count2 * processing / processed.inputCount, "processed");
    }
    for (const drop of action.essenceDropTable || []) addOutput(drop.itemHrid, meanCount(drop) * (1 + fraction(BUFF.essence)), "essence");
    for (const drop of action.rareDropTable || []) addOutput(drop.itemHrid, meanCount(drop) * (1 + fraction(BUFF.rare)), "rare");
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
    const revenuePerAction = outputs.reduce((sum, o) => sum + o.value, 0);
    const costPerAction = inputs.reduce((sum, i) => sum + i.value, 0);
    const teaPerHour = teaCosts.reduce((sum, t3) => sum + t3.perHour, 0);
    const profitPerHour = actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour;
    const margin = revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null;
    const xpPerAction = (action.experienceGain?.value || 0) * (1 + fraction(BUFF.wisdom));
    const main = outputs.filter((o) => o.kind === "product").sort((a, b) => b.value - a.value)[0] || null;
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
    const grow = (start, chosen) => {
      if (chosen.length >= slots) return;
      for (let i = start; i < candidates.length; i++) {
        if (chosen.some((hrid) => unique(hrid) === unique(candidates[i]))) continue;
        const next = [...chosen, candidates[i]];
        setups.push(next);
        grow(i + 1, next);
      }
    };
    grow(0, []);
    return setups;
  }
  function limitSales(result, sellCap) {
    const made = result.action.function === "/action_functions/production" ? result.mainCount * result.actionsPerHour : 0;
    const hoursPerDay = sellCap > 0 && made > 0 && made * HOURS_PER_DAY > sellCap ? sellCap / made : HOURS_PER_DAY;
    return { ...result, hoursPerDay, capped: hoursPerDay < HOURS_PER_DAY, goldPerDay: result.profitPerHour * hoursPerDay, xpPerDay: result.xpPerHour * hoursPerDay };
  }
  function bestTeas(action, who, data, market, evaluate, score2 = (r) => r.goldPerDay) {
    const type = action.type;
    const candidates = usableTeas(data, type).filter((hrid) => market.buy(hrid) !== null || (who.drinks[type] || []).includes(hrid));
    let best = null;
    for (const teas of teaSetups(data, type, who.slots[type], candidates)) {
      const result = evaluate(teas);
      if (!best || score2(result) > score2(best) + 1e-12) best = result;
    }
    const worth = best.teas.map((hrid) => {
      const without = evaluate(best.teas.filter((t3) => t3 !== hrid));
      return { itemHrid: hrid, gainPerDay: best.goldPerDay - without.goldPerDay, xpPerDay: best.xpPerDay - without.xpPerDay };
    });
    return { result: best, worth };
  }
  function focusScore(goldWeight, refs) {
    return (r) => goldWeight * r.goldPerDay / refs.gold + (1 - goldWeight) * r.xpPerDay / refs.xp;
  }
  function teaPurchase(entry, { hours, have: have3 = () => 0 }) {
    const teas = entry.best.result.teas;
    if (!teas.length || !(hours > 0)) return null;
    const perTea = Math.ceil(hours * entry.best.result.drinksPerHour);
    const items = teas.map((hrid) => ({ hrid, quantity: perTea - have3(hrid), have: have3(hrid) })).filter((item) => item.quantity > 0);
    return { hours, perTea, items };
  }
  function heldStock(character, items, itemHrid) {
    let inventory = 0;
    for (const item of items.values()) {
      if (item.itemHrid === itemHrid && item.itemLocationHrid === INVENTORY2 && !item.enhancementLevel) inventory += item.count || 0;
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
    const lowest = Math.min(...book.asks.map((o) => o.price));
    const top = lowest * (1 + ASK_WINDOW);
    const near = book.asks.filter((o) => o.price <= top).reduce((sum, o) => sum + o.quantity, 0);
    const mine = (stock.listings || []).filter((l) => l.price > 0 && l.price <= top).reduce((sum, l) => sum + l.quantity, 0);
    return { quantity: Math.max(0, near - mine), lowest };
  }
  function breakEvenPrice(entry) {
    const main = entry.outputs.filter((o) => o.kind === "product").sort((a, b) => b.value - a.value)[0];
    if (!main) return null;
    const others = entry.revenuePerAction - main.value;
    return (entry.costPerAction + entry.teaPerHour / entry.actionsPerHour - others) / main.count / (1 - MARKET_TAX);
  }
  var LIQUIDITY = {
    stable: { both: 0.9, spread: 0.05, swing: 0.03, activity: 0.3 },
    ok: { both: 0.75, spread: 0.15, swing: 0.08, activity: 0 }
  };
  var LIQUIDITY_HOURS = 12;
  var RATING_ORDER = { thin: 0, ok: 1, stable: 2 };
  var INPUT_BOOK_HOURS = 12;
  function liquidityRating(summary) {
    const l = summary?.liquidity;
    const swing = summary?.a?.swing;
    if (!l || l.hours < LIQUIDITY_HOURS || l.spread === null || swing === null) return { rating: "thin", known: false, ...l, swing: swing ?? null };
    const meets = (t3) => l.both >= t3.both && l.spread <= t3.spread && swing <= t3.swing && l.activity >= t3.activity;
    return { rating: meets(LIQUIDITY.stable) ? "stable" : meets(LIQUIDITY.ok) ? "ok" : "thin", known: true, ...l, swing };
  }
  var PLAN_MODES = {
    away: { hours: 8, coinShare: { stable: 0.6, ok: 0.3, thin: 0.1 }, hideThinMargins: true },
    active: { hours: 1, coinShare: { stable: 0.8, ok: 0.5, thin: 0.2 }, hideThinMargins: false }
  };
  function thinMargin(entry, swing = null) {
    if (!(entry.costPerAction > 0) || entry.margin === null || !(entry.profitPerHour > 0)) return false;
    return entry.margin < RISKY_MARGIN || swing > CALM_SWING && entry.margin < swing;
  }
  var CALM_SWING = 0.05;
  var MIN_SWING_SHARE = 0.4;
  var HIGH_PRICE_SHARE = 0.5;
  var PRICE_BAND = 0.1;
  function swingShare(price) {
    if (!price || !(price.swing > 0)) return null;
    const bySwing = Math.min(1, Math.max(MIN_SWING_SHARE, 1 - 2 * (price.swing - CALM_SWING)));
    const high = price.diff !== null && price.diff > PRICE_BAND && price.swing > CALM_SWING;
    const low = price.diff !== null && price.diff < -PRICE_BAND;
    return { swing: price.swing, diff: price.diff, bySwing, high, low, share: bySwing * (high ? HIGH_PRICE_SHARE : 1) };
  }
  function suggestCount(entry, { stock, book = null, sellCap = 0, hours = PLAN_MODES.away.hours, coinShare = PLAN_MODES.away.coinShare, coins: coins5 = Infinity, have: have3 = () => 0, sellAt = "ask", price = null, liquidity: liquidity2 = null, inputMarket = null, now = Date.now() }) {
    if (entry.action.function !== "/action_functions/production" || !entry.valid || entry.profitPerHour <= 0 || !entry.mainCount) return null;
    const breakEven = breakEvenPrice(entry);
    const profitableBids = book ? book.bids.filter((o) => o.price >= breakEven).reduce((sum, o) => sum + o.quantity, 0) : null;
    const asks = book && sellAt === "ask" ? othersNearLowestAsk(book, stock) : null;
    const product = liquidity2 || { rating: "thin", known: false };
    const planned = Math.max(1, Math.floor(hours * entry.actionsPerHour));
    const capUnits = sellCap > 0 ? sellCap : Infinity;
    const plannedUnits = Math.min(planned * entry.mainCount, capUnits);
    const held = stock.inventory + stock.listed;
    let count2 = Math.max(0, Math.ceil((plannedUnits - held) / entry.mainCount - 1e-9));
    const swing = swingShare(price);
    if (swing && swing.share < 1) count2 = Math.ceil(count2 * swing.share);
    const toBuy2 = (input, n2) => Math.max(0, input.count * n2 - have3(input.itemHrid));
    const spend = (n2) => entry.inputs.reduce((sum, input) => sum + toBuy2(input, n2) * (input.price || 0), 0);
    const bought = entry.inputs.filter((input) => input.count > 0 && input.price > 0 && toBuy2(input, count2) > 0);
    const inputs = bought.map((input) => {
      const market = inputMarket?.(input.itemHrid) || {};
      const fresh = market.book && now - market.book.at <= INPUT_BOOK_HOURS * 36e5 ? market.book : null;
      const asks2 = fresh ? othersNearLowestAsk(fresh, { listings: [] }) : null;
      return {
        itemHrid: input.itemHrid,
        perAction: input.count,
        liquidity: market.liquidity || null,
        nearAsks: asks2?.quantity ?? null,
        lowestAsk: asks2?.lowest ?? null,
        bookAt: fresh?.at ?? null,
        maxCount: asks2 ? Math.floor((have3(input.itemHrid) + asks2.quantity) / input.count + 1e-9) : Infinity
      };
    });
    let limitedByBook = null;
    for (const input of inputs) {
      if (input.maxCount < count2) {
        count2 = input.maxCount;
        limitedByBook = input.itemHrid;
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
    const budget = coins5 * share;
    let limitedByCoins = false;
    if (spend(count2) > budget) {
      let low = 0;
      let high = count2;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (spend(mid) <= budget) low = mid;
        else high = mid - 1;
      }
      count2 = low;
      limitedByCoins = true;
    }
    const jobHours = count2 / entry.actionsPerHour;
    const batch = {
      materials: count2 * entry.costPerAction,
      toBuy: spend(count2),
      revenue: count2 * entry.revenuePerAction,
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
      plannedHours: hours,
      plannedUnits,
      cappedBySales: plannedUnits < planned * entry.mainCount,
      liquidity: rating,
      productLiquidity: product,
      ratedBy,
      inputs: inputs.map((input) => ({ ...input, toBuy: Math.max(0, Math.ceil(input.perAction * count2 - have3(input.itemHrid) - 1e-9)) })),
      limitedByBook,
      coinShare: share,
      budget,
      count: count2,
      hours: jobHours,
      fill: Math.min(1, jobHours / hours),
      batch,
      swing,
      limitedByCoins
    };
  }
  function chainBuilder(who, data, market, teaMode) {
    const sources = /* @__PURE__ */ new Map();
    for (const action of skillingActions(data)) {
      const made = action.outputItems?.length ? action.outputItems.map((o) => o.itemHrid) : (action.dropTable || []).map((d) => d.itemHrid);
      for (const hrid of made) {
        if (!sources.has(hrid)) sources.set(hrid, []);
        sources.get(hrid).push(action);
      }
    }
    const runs = /* @__PURE__ */ new Map();
    const run = (action) => {
      if (!runs.has(action.hrid)) {
        const plain = (teas) => limitSales(evaluateAction(action, who, data, market, teas), 0);
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
        const out = r.outputs.find((o) => o.itemHrid === itemHrid && o.kind === "product");
        if (!out || out.count <= 0) continue;
        const inner = materials(r, /* @__PURE__ */ new Set([...seen, itemHrid]));
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
    const materials = (r, seen) => {
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
      const inner = materials(entry, /* @__PURE__ */ new Set([entry.action.outputItems?.[0]?.itemHrid]));
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
  var sameTeas = (a, b) => a.length === b.length && a.every((hrid) => b.includes(hrid));
  function rankSkilling(who, data, market, { skill = "all", teaMode = "current", sellCap = 0, plan = null, goldWeight = 1 } = {}) {
    var _a;
    const evaluator = (action, level) => (teas) => limitSales(evaluateAction(action, who, data, market, teas, level), sellCap);
    const wanted = (action) => skill === "all" || action.type === skillType(skill);
    const doable = [];
    const near = [];
    for (const action of skillingActions(data)) {
      if (!wanted(action) || who.levels[action.levelRequirement.skillHrid] === void 0) continue;
      const level = who.levels[action.levelRequirement.skillHrid];
      const required = action.levelRequirement.level;
      if (required <= level) {
        const evaluate = evaluator(action, level);
        doable.push({ action, evaluate, current: evaluate(who.drinks[action.type] || []) });
      } else if (required <= level + NEAR_LEVELS) {
        near.push(action);
      }
    }
    const refs = { gold: 1, xp: 1 };
    const skillRefs = {};
    for (const { action, evaluate } of doable) {
      const gold = bestTeas(action, who, data, market, evaluate, (r) => r.goldPerDay).result;
      const xp = bestTeas(action, who, data, market, evaluate, (r) => r.xpPerDay).result;
      const own = skillRefs[_a = action.type] || (skillRefs[_a] = { gold: 1, xp: 1 });
      for (const r of [refs, own]) {
        if (gold.valid) r.gold = Math.max(r.gold, gold.goldPerDay);
        if (xp.valid) r.xp = Math.max(r.xp, xp.xpPerDay);
      }
    }
    const score2 = focusScore(goldWeight, refs);
    const chain = chainBuilder(who, data, market, teaMode);
    const available = doable.map(({ action, evaluate, current }) => {
      const teaScore = focusScore(goldWeight, skillRefs[action.type]);
      const best = bestTeas(action, who, data, market, evaluate, teaScore);
      const shown = teaMode === "best" ? best.result : current;
      const price = plan?.price?.(shown.action) ?? null;
      const liquidity2 = plan?.liquidity?.(shown.action) ?? null;
      const suggestion = plan ? suggestCount(shown, { ...plan, stock: plan.stock(shown.action), book: plan.book(shown.action), price, liquidity: liquidity2, sellCap }) : null;
      const fill = suggestion ? suggestion.fill : 1;
      const entry = {
        ...shown,
        teaMode,
        current,
        best,
        suggestion,
        chain: chain(shown),
        score: score2({ goldPerDay: shown.goldPerDay * fill, xpPerDay: shown.xpPerDay * fill }),
        thinMargin: !!plan?.hideThinMargins && thinMargin(shown, price?.swing ?? null),
        teaSlots: who.slots[action.type],
        pouch: who.pouch,
        betterTeas: !sameTeas(best.result.teas, current.teas) && teaScore(best.result) > teaScore(current) + 1e-9
      };
      if (plan) {
        const hours = suggestion?.count ? suggestion.count / best.result.actionsPerHour : action.function === "/action_functions/gathering" ? plan.hours : 0;
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
      const have3 = who.experience[skillHrid];
      const needXp = Array.isArray(table) && have3 !== null && table[required] !== void 0 ? Math.max(0, table[required] - have3) : null;
      const hours = needXp !== null && fastestXp[skillHrid] > 0 ? needXp / fastestXp[skillHrid] : null;
      return { ...atUnlock, needLevels: required - (who.levels[skillHrid] ?? 1), needXp, hoursToUnlock: hours };
    });
    upcoming.sort((a, b) => a.needLevels - b.needLevels || b.goldPerDay - a.goldPerDay);
    return { available, upcoming };
  }

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
    const add = (typeHrid, amount) => amount && buffs.push({ typeHrid, flatBoost: amount, ratioBoost: 0 });
    add("/buff_types/action_speed", value(skill + "Speed") + value("skillingSpeed"));
    add("/buff_types/efficiency", value(skill + "Efficiency") + value("skillingEfficiency"));
    add("/buff_types/wisdom", value(skill + "Experience") + value("skillingExperience"));
    add("/buff_types/rare_find", value(skill + "RareFind") + value("skillingRareFind"));
    if (GATHERING_SKILLS.has(skill)) add("/buff_types/gathering", value("gatheringQuantity"));
    return { buffs, concentration: value("drinkConcentration") };
  }
  var negate = (buffs) => buffs.map((b) => ({ ...b, flatBoost: -b.flatBoost }));
  var location = (itemHrid, data) => "/item_locations/" + (data.itemDetailMap[itemHrid]?.equipmentDetail?.type || "").split("/").pop();
  function bestDay(actions, who, data, market, sellCap) {
    let best = null;
    for (const action of actions) {
      const r = limitSales(evaluateAction(action, who, data, market), sellCap);
      if (r.valid && (!best || r.goldPerDay > best.goldPerDay)) best = r;
    }
    return best;
  }
  function bestDayWithTeas(actions, who, data, market, sellCap) {
    let best = null;
    for (const action of actions) {
      const evaluate = (teas) => limitSales(evaluateAction(action, who, data, market, teas), sellCap);
      const r = bestTeas(action, who, data, market, evaluate).result;
      if (r.valid && (!best || r.goldPerDay > best.goldPerDay)) best = r;
    }
    return best;
  }
  function swapGain(who, data, market, skill, current, itemHrid, enhancementLevel = 0, sellCap = 0) {
    const type = skillType(skill);
    const actions = skillingActions(data).filter((a) => a.type === type && (who.levels[a.levelRequirement.skillHrid] ?? 1) >= a.levelRequirement.level);
    const base = bestDay(actions, who, data, market, sellCap);
    if (!base) return null;
    const old = current ? itemSkillBuffs(current.itemHrid, current.enhancementLevel, skill, data) : { buffs: [], concentration: 0 };
    const next = itemSkillBuffs(itemHrid, enhancementLevel, skill, data);
    const after = bestDay(actions, { ...who, buffs: { ...who.buffs || {}, [type]: [...who.buffs?.[type] || [], ...negate(old.buffs), ...next.buffs] }, concentration: who.concentration + next.concentration - old.concentration }, data, market, sellCap);
    return { gainPerDay: after.goldPerDay - base.goldPerDay, xpPerDay: after.xpPerDay - base.xpPerDay, bestAction: after.action };
  }
  function rankUpgrades(who, data, market, skill, { equipped, owned, listings, houseLevels, sellCap = 0, gameEquipmentBuffs = null }) {
    const type = skillType(skill);
    const actions = skillingActions(data).filter((a) => a.type === type && (who.levels[a.levelRequirement.skillHrid] ?? 1) >= a.levelRequirement.level);
    const base = bestDay(actions, who, data, market, sellCap);
    if (!base) return { base: null, upgrades: [], check: null };
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
        const key = offer.enhancementLevel;
        if (seen.has(key)) continue;
        seen.add(key);
        if (current && current.itemHrid === item.hrid && current.enhancementLevel >= offer.enhancementLevel) continue;
        const next = itemSkillBuffs(item.hrid, offer.enhancementLevel, skill, data);
        const changed = withBuffs([...negate(old.buffs), ...next.buffs], next.concentration - old.concentration, Math.max(slotsAfter, who.drinks[type]?.length || 0));
        let after;
        let from = base;
        if (slotsAfter !== who.slots[type]) {
          teaBase || (teaBase = bestDayWithTeas(actions, who, data, market, sellCap));
          from = teaBase;
          after = bestDayWithTeas(actions, changed, data, market, sellCap);
        } else after = bestDay(actions, changed, data, market, sellCap);
        const gain = after.goldPerDay - from.goldPerDay;
        if (gain <= 1) continue;
        upgrades.push({
          kind: "item",
          itemHrid: item.hrid,
          enhancementLevel: offer.enhancementLevel,
          owned: !!offer.owned,
          price: offer.price,
          replaces: current,
          gainPerDay: gain,
          xpPerDay: after.xpPerDay - from.xpPerDay,
          paybackDays: offer.price / gain,
          bestAction: after.action,
          extraSlots: slotsAfter - who.slots[type],
          teas: slotsAfter !== who.slots[type] ? after.teas : null
        });
      }
    }
    const room = Object.values(data.houseRoomDetailMap || {}).find((r) => r.skillHrid === "/skills/" + skill);
    const level = room ? houseLevels[room.hrid] || 0 : MAX_HOUSE_LEVEL;
    if (room && level < MAX_HOUSE_LEVEL) {
      const step = [...room.actionBuffs || [], ...room.globalBuffs || []].map((b) => ({ typeHrid: b.typeHrid, flatBoost: level === 0 ? b.flatBoost : b.flatBoostLevelBonus, ratioBoost: 0 }));
      const after = bestDay(actions, withBuffs(step), data, market, sellCap);
      const costs = room.upgradeCostsMap?.[String(level + 1)] || [];
      const priced = costs.map((c2) => ({ itemHrid: c2.itemHrid, count: c2.count, price: market.buy(c2.itemHrid) }));
      const price = priced.some((c2) => c2.price === null) ? null : priced.reduce((sum, c2) => sum + c2.count * c2.price, 0);
      const gain = after.goldPerDay - base.goldPerDay;
      if (gain > 1) {
        upgrades.push({ kind: "house", roomHrid: room.hrid, name: room.name, level: level + 1, price, materials: priced, gainPerDay: gain, xpPerDay: after.xpPerDay - base.xpPerDay, paybackDays: price === null ? null : price / gain, bestAction: after.action });
      }
    }
    upgrades.sort((a, b) => (a.paybackDays ?? Infinity) - (b.paybackDays ?? Infinity));
    let check = null;
    if (gameEquipmentBuffs) {
      const game = (gameEquipmentBuffs[type] || []).filter((b) => b.typeHrid === "/buff_types/action_speed").reduce((sum, b) => sum + (b.flatBoost || 0) + (b.ratioBoost || 0), 0);
      const mine = Object.values(equipped).reduce((sum, e) => sum + itemSkillBuffs(e.itemHrid, e.enhancementLevel, skill, data).buffs.filter((b) => b.typeHrid === "/buff_types/action_speed").reduce((s, b) => s + b.flatBoost, 0), 0);
      check = { game, mine, matches: Math.abs(game - mine) < 5e-3 };
    }
    return { base, upgrades, check };
  }
  function toolTiers(who, data, market, { equipped, owned, sellCap = 0 }) {
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
      const gain = SKILLING_SKILLS.includes(skill) ? swapGain(who, data, market, skill, current, best.itemHrid, 0, sellCap) : null;
      const isOwned = !!owned[best.itemHrid]?.length;
      const price = isOwned ? 0 : market.buy(best.itemHrid);
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
        paybackDays: gain && gain.gainPerDay > 1 && price !== null ? price / gain.gainPerDay : null
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
  function dayStats(values) {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return [NaN, NaN, NaN, 0];
    return [median(finite.map((v) => [v, 1])), Math.min(...finite), Math.max(...finite), finite.length];
  }
  function rollUpDays(hourlyRecords, itemCount) {
    const byDay = /* @__PURE__ */ new Map();
    for (const record of hourlyRecords) {
      const day = Math.floor(record.hour / 24);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(record);
    }
    return [...byDay].map(([day, records]) => {
      const out = { day, a: new Float32Array(itemCount), b: new Float32Array(itemCount), aLow: new Float32Array(itemCount), aHigh: new Float32Array(itemCount), bLow: new Float32Array(itemCount), bHigh: new Float32Array(itemCount), n: new Uint8Array(itemCount) };
      for (let i = 0; i < itemCount; i++) {
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
  function summarize2(i, hours, days, nowHour) {
    const side = (key) => {
      const week = [];
      const before = [];
      const month = [];
      for (const r of hours) {
        const v = at(r[key], i);
        if (!Number.isFinite(v)) continue;
        const age = nowHour - r.hour;
        if (age < 7 * 24) week.push([v, 1]);
        else if (age < 14 * 24) before.push([v, 1]);
        if (age < 30 * 24) month.push([v, 1]);
      }
      for (const d of days) {
        const v = at(d[key], i);
        if (Number.isFinite(v) && nowHour - (d.day * 24 + 12) < 30 * 24) month.push([v, at(d.n, i) || 1]);
      }
      const week7 = median(week);
      const previous = before.length >= MIN_HOURS ? median(before) : null;
      const swing = week7 ? median(week.map(([v, w]) => [Math.abs(v / week7 - 1), w])) : null;
      return { med7: week7, med30: median(month), trend: week7 && previous ? week7 / previous - 1 : null, swing };
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
    return { hours: observed, both: observed ? both / observed : 0, spread: median(spreads), activity: pairs ? moves / pairs : 0 };
  }
  function historyCsv(items, hours, days, exportedAt = /* @__PURE__ */ new Date()) {
    const num = (v) => Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "";
    const hourText = (hour) => new Date(hour * HOUR_MS).toISOString().slice(0, 13);
    const dayText = (day) => new Date(day * 24 * HOUR_MS).toISOString().slice(0, 10);
    const id = (hrid) => hrid.replace(/^\/items\//, "");
    const lines = [
      `# MWI Combat Advisor price history, exported ${exportedAt.toISOString().slice(0, 16)}Z; saved while the game was open on one device.`,
      "# ask = lowest sell order, bid = best buy order, in coins; empty = none. Times are UTC.",
      `# section hour: an item's row appears when its ask or bid changed since its previous row (in between it stayed the same).`,
      `# Hours with data: ${hours.map((r) => hourText(r.hour)).join(",")}`,
      `# section day (older than ${HOURLY_DAYS} days): the day's median ask and bid, their low and high, and how many hours had data.`,
      "section,time,item,ask,bid,ask_low,ask_high,bid_low,bid_high,hours"
    ];
    const previous = /* @__PURE__ */ new Map();
    for (const r of hours) {
      items.forEach((hrid, i) => {
        const pair = num(at(r.a, i)) + "," + num(at(r.b, i));
        if (previous.get(i) === pair || !previous.has(i) && pair === ",") return;
        previous.set(i, pair);
        lines.push(`hour,${hourText(r.hour)},${id(hrid)},${pair}`);
      });
    }
    for (const d of days) {
      items.forEach((hrid, i) => {
        if (!at(d.n, i)) return;
        lines.push(`day,${dayText(d.day)},${id(hrid)},${[d.a, d.b, d.aLow, d.aHigh, d.bLow, d.bHigh].map((list) => num(at(list, i))).join(",")},${at(d.n, i)}`);
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
      const [items, last, hours] = await Promise.all([request(tx.objectStore(META).get("items")), request(tx.objectStore(META).get("last")), request(tx.objectStore(HOURLY).getAll())]);
      const newest = hours.length ? hours[hours.length - 1].hour : 0;
      store2.days = await request(store2.db.transaction(DAILY, "readonly").objectStore(DAILY).getAll(IDBKeyRange.lowerBound(Math.floor(newest / 24) - 31)));
      store2.items = items || [];
      store2.items.forEach((hrid, i) => store2.index.set(hrid, i));
      store2.last = last ?? null;
      store2.hours = hours;
      store2.version++;
    })());
    return store2.ready;
  }
  async function recordSnapshot(marketData, timestamp) {
    await loadHistory();
    if (timestamp && timestamp === store2.last) return false;
    const hour = Math.floor(Date.now() / HOUR_MS);
    for (const hrid of Object.keys(marketData)) {
      if (!store2.index.has(hrid)) {
        store2.index.set(hrid, store2.items.length);
        store2.items.push(hrid);
      }
    }
    const count2 = store2.items.length;
    const record = { hour, a: new Float32Array(count2).fill(NaN), b: new Float32Array(count2).fill(NaN) };
    for (const [hrid, levels] of Object.entries(marketData)) {
      const entry = levels?.["0"];
      if (!entry) continue;
      const i = store2.index.get(hrid);
      if (entry.a > 0) record.a[i] = entry.a;
      if (entry.b > 0) record.b[i] = entry.b;
    }
    store2.hours = store2.hours.filter((r) => r.hour !== hour);
    store2.hours.push(record);
    store2.hours.sort((x, y) => x.hour - y.hour);
    const newest = store2.hours[store2.hours.length - 1].hour;
    const cutoffDay = Math.floor((newest - HOURLY_DAYS * 24) / 24);
    const old = store2.hours.filter((r) => Math.floor(r.hour / 24) < cutoffDay);
    const rolled = old.length ? rollUpDays(old, count2) : [];
    store2.hours = store2.hours.filter((r) => Math.floor(r.hour / 24) >= cutoffDay);
    store2.days = [...store2.days, ...rolled].filter((d) => d.day >= Math.floor(newest / 24) - 31).sort((x, y) => x.day - y.day);
    if (store2.allDays) store2.allDays = [...store2.allDays, ...rolled].sort((x, y) => x.day - y.day);
    const tx = store2.db.transaction([HOURLY, DAILY, META], "readwrite");
    tx.objectStore(HOURLY).put(record);
    for (const r of old) tx.objectStore(HOURLY).delete(r.hour);
    for (const d of rolled) tx.objectStore(DAILY).put(d);
    tx.objectStore(DAILY).delete(IDBKeyRange.upperBound(Math.floor(newest / 24) - DAILY_DAYS, true));
    tx.objectStore(META).put(store2.items, "items");
    tx.objectStore(META).put(timestamp ?? null, "last");
    await done(tx);
    store2.last = timestamp ?? null;
    store2.version++;
    store2.summaries.clear();
    return true;
  }
  var historyVersion = () => store2.version;
  function priceSummary(itemHrid) {
    if (!store2.hours.length) return null;
    const i = store2.index.get(itemHrid);
    if (i === void 0) return null;
    if (!store2.summaries.has(itemHrid)) {
      store2.summaries.set(itemHrid, summarize2(i, store2.hours, store2.days, store2.hours[store2.hours.length - 1].hour));
    }
    return store2.summaries.get(itemHrid);
  }
  async function loadAllDays() {
    await loadHistory();
    if (!store2.allDays) {
      const tx = store2.db.transaction(DAILY, "readonly");
      store2.allDays = await request(tx.objectStore(DAILY).getAll());
    }
    return store2.allDays;
  }
  async function priceSeries(itemHrid, range) {
    await loadHistory();
    const i = store2.index.get(itemHrid);
    if (i === void 0 || !store2.hours.length) return [];
    const newest = store2.hours[store2.hours.length - 1].hour;
    const days = range > 31 ? await loadAllDays() : store2.days;
    const points = [];
    for (const d of days) {
      const t3 = d.day * 24 + 12;
      if (newest - t3 <= range * 24) points.push({ t: t3, a: at(d.a, i), b: at(d.b, i) });
    }
    for (const r of store2.hours) if (newest - r.hour <= range * 24) points.push({ t: r.hour, a: at(r.a, i), b: at(r.b, i) });
    return points.filter((p) => Number.isFinite(p.a) || Number.isFinite(p.b)).sort((x, y) => x.t - y.t);
  }
  async function longMedians(itemHrid) {
    const i = store2.index.get(itemHrid);
    if (i === void 0) return null;
    const days = await loadAllDays();
    const newestDay = days.length ? days[days.length - 1].day : 0;
    const pick = (key, span) => median(days.filter((d) => newestDay - d.day < span).map((d) => [at(d[key], i), at(d.n, i) || 1]));
    return { a90: pick("a", 90), b90: pick("b", 90), a365: pick("a", 365), b365: pick("b", 365), days: days.filter((d) => at(d.n, i)).length };
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
  var dec = (n2, d = 1) => n2.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  var pct = (fraction) => `${fraction >= 0 ? "+" : ""}${dec(fraction * 100, 1)}%`;
  var count = (n2) => n2 >= 100 ? dec(n2, 0) : n2 >= 1 ? dec(n2, 2) : n2.toPrecision(2);
  var coins = (n2) => (n2 < 0 ? "\u2212" : "") + shortCoins(Math.abs(n2));
  var skillLabel = (skill) => skill.charAt(0).toUpperCase() + skill.slice(1);
  var skillOf = (entry) => entry.skill.split("/").pop();
  var names = (teas) => teas.map(itemName).join(", ");
  var planMode = (s) => s.skillingMode === "active" ? "active" : "away";
  var goldShare = (s) => s.skillingGold === void 0 || s.skillingGold === "" ? 100 : Number(s.skillingGold);
  var focusLabel = (gold) => gold === 0 ? "XP only" : gold === 100 ? "Gold only" : `${100 - gold}% XP \xB7 ${gold}% gold`;
  function hoursText(hours) {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours < 48) return `${dec(hours, hours < 10 ? 1 : 0)} h`;
    return `${dec(hours / 24, hours < 240 ? 1 : 0)} days`;
  }
  function skillingSettingsHtml(s) {
    const option = (value, label, current) => `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`;
    return `<div class="mwia-settings">
      <label>Skill <select data-setting="skillingSkill">${option("all", "All skills", s.skillingSkill)}${SKILLING_SKILLS.map((k) => option(k, skillLabel(k), s.skillingSkill)).join("")}</select></label>
      <label title="Products are listed at the cheapest ask (you wait for a buyer) or sold instantly to the best bid. The 4% market tax is taken off either way.">Sell at <select data-setting="skillingSellAt">${option("ask", "Ask (list it)", s.skillingSellAt)}${option("bid", "Bid (sell now)", s.skillingSellAt)}</select></label>
      <label title="Rank with the teas you have in the skill's drink slots now, or with the setup that earns the most.">Teas <select data-setting="skillingTeas">${option("current", "My current teas", s.skillingTeas)}${option("best", "Best teas", s.skillingTeas)}</select></label>
      <label title="How many of one crafted item the market takes a day, e.g. 500 or 2k. Past it the action only runs part of the day. Empty: no limit. Gathered raw materials are never limited.">Max sold/day <input data-setting="skillingSellCap" type="text" inputmode="decimal" size="6" placeholder="no limit" value="${Number(s.skillingSellCap) > 0 ? coinsInput(Number(s.skillingSellCap)) : ""}"></label>
      <label title="Away: a careful job of about ${PLAN_MODES.away.hours} h, little of your coins unless the market is stable, thin margins left out. Active: ${PLAN_MODES.active.hours} h jobs, more of your coins, thin margins shown.">Plan <select data-setting="skillingMode">${option("away", `Away (${PLAN_MODES.away.hours} h)`, planMode(s))}${option("active", `Active (${PLAN_MODES.active.hours} h)`, planMode(s))}</select></label>
      <label class="mwia-focus" title="Rank by gold per day, XP per day, or a mix. Each counts as a share of the most any action in the list gives. The best teas follow the same focus.">
        Focus: <span class="mwia-focus-text">${focusLabel(goldShare(s))}</span>
        <span class="mwia-focus-row">XP <input type="range" min="0" max="100" step="10" value="${goldShare(s)}" data-setting="skillingGold"> Gold</span></label>
    </div>`;
  }
  var rankings = /* @__PURE__ */ new Map();
  var KEPT_RANKINGS = 3;
  function ranking(settings) {
    const key = [state.updatedAt, pricesStamp(), settings.skillingSkill, settings.skillingSellAt, settings.skillingTeas, settings.skillingSellCap, planMode(settings), goldShare(settings), historyVersion()].join("|");
    if (!rankings.has(key)) {
      rankings.set(key, computeRanking(settings));
      while (rankings.size > KEPT_RANKINGS) rankings.delete(rankings.keys().next().value);
    }
    return rankings.get(key);
  }
  function skillingAdvice(actionHrid, settings) {
    const skill = actionHrid.split("/")[2];
    if (!SKILLING_SKILLS.includes(skill)) return null;
    const result = ranking({ ...settings, skillingSkill: skill });
    return result.available.find((entry) => entry.hrid === actionHrid) || null;
  }
  function computeRanking(settings) {
    const data = getClientData();
    {
      const who = skillingCharacter(state.character, state.items, data);
      const market = skillingMarket(settings.skillingSellAt);
      const plan = {
        stock: (action) => heldStock(state.character, state.items, action.outputItems?.[0]?.itemHrid),
        book: (action) => state.orderBooks.get(action.outputItems?.[0]?.itemHrid) || null,
        ...PLAN_MODES[planMode(settings)],
        coins: have("/items/coin"),
        have,
        sellAt: settings.skillingSellAt,
        price: (action) => priceNow(action.outputItems?.[0]?.itemHrid, settings.skillingSellAt),
        liquidity: (action) => liquidityRating(action.outputItems?.[0]?.itemHrid ? priceSummary(action.outputItems[0].itemHrid) : null),
        inputMarket: (hrid) => ({ liquidity: liquidityRating(priceSummary(hrid)), book: state.orderBooks.get(hrid) || null })
      };
      const result = rankSkilling(who, data, market, { skill: settings.skillingSkill, teaMode: settings.skillingTeas, sellCap: Number(settings.skillingSellCap) || 0, plan, goldWeight: goldShare(settings) / 100 });
      for (const entry of [...result.available, ...result.upcoming]) entry.warnings = [...entry.warnings, ...priceWarnings(entry)];
      return result;
    }
  }
  function skillingMarket(sellAt) {
    const usualAsk = (hrid) => {
      const summary = priceSummary(hrid);
      return summary && summary.hours7 >= MIN_HOURS ? summary.a.med7 : null;
    };
    return marketPricer((hrid) => marketEntry(hrid), getClientData(), sellAt, usualAsk);
  }
  function priceNow(itemHrid, sellAt) {
    const summary = itemHrid ? priceSummary(itemHrid) : null;
    if (!summary?.enough) return null;
    const side = sellAt === "bid" ? "b" : "a";
    const now = marketEntry(itemHrid)?.[side];
    const usual = summary[side].med7;
    return { swing: summary[side].swing, diff: now > 0 && usual > 0 ? now / usual - 1 : null };
  }
  function priceWarnings(entry) {
    const warnings = [];
    const main = entry.outputs.filter((o) => o.kind === "product").sort((a, b) => b.value - a.value)[0];
    if (main && (main.sell.source === "ask" || main.sell.source === "bid")) {
      const summary = priceSummary(main.itemHrid);
      const side = main.sell.source === "ask" ? "a" : "b";
      const versus = summary?.enough ? versusUsual(main.sell[main.sell.source], summary[side].med7) : null;
      if (versus && versus.label !== "near") warnings.push({ kind: versus.label === "above" ? "pricehigh" : "pricelow", itemHrid: main.itemHrid, diff: versus.diff, usual: summary[side].med7 });
      const swing = summary?.enough ? summary[side].swing : null;
      if (swing > CALM_SWING && entry.margin > 0 && entry.margin < swing) warnings.push({ kind: "swing", itemHrid: main.itemHrid, swing, margin: entry.margin });
    }
    for (const input of entry.inputs) {
      const summary = priceSummary(input.itemHrid);
      const versus = summary?.enough ? versusUsual(input.price, summary.a.med7) : null;
      if (versus?.label === "above") warnings.push({ kind: "inputhigh", itemHrid: input.itemHrid, diff: versus.diff, usual: summary.a.med7 });
    }
    return warnings;
  }
  function rememberToggle(event) {
    const key = event.target.dataset?.open;
    if (!key) return;
    if (event.target.open) view.open.add(key);
    else view.open.delete(key);
  }
  function toggleShowAll() {
    view.showAll = !view.showAll;
  }
  function renderSkilling(settings) {
    const { available, upcoming } = ranking(settings);
    let html = skillingSettingsHtml(settings);
    html += `<p class="mwia-dim">Gold per day after the ${dec(MARKET_TAX * 100, 0)}% market tax, with materials and teas bought at the cheapest ask. Only what your levels allow. Tap a row to see how it was worked out.</p>`;
    if (available[0] && !available[0].buffsKnown) {
      html += `<div class="mwia-notice mwia-notice-warn">The game hasn't sent your buffs (house, equipment, community) yet, so only levels and teas are counted. Reload the page to fix it.</div>`;
    }
    const listed = available.filter((entry) => !entry.thinMargin);
    const thin = available.length - listed.length;
    const shown = view.showAll ? available : listed.slice(0, SHORT_LIST);
    const mode = PLAN_MODES[planMode(settings)];
    html += `<section><h3>Best now</h3><p class="mwia-dim">Ranked by what a ${mode.hours} h job gives: the amount is what your coins, your stock and the market allow \u2013 no need to open the market.</p>`;
    if (!available.length) html += `<p class="mwia-dim">Nothing to do in this skill at your level.</p>`;
    html += `<div class="mwia-skill-list">${shown.map((entry, i) => rowHtml(entry, i === 0 && entry.valid && entry.profitPerHour > 0 && !entry.thinMargin)).join("")}</div>`;
    if (available.length > shown.length || view.showAll) {
      const hidden = thin ? ` (${thin} with a thin margin)` : "";
      html += `<button class="mwia-link" data-action="skilling-all">${view.showAll ? "Show fewer" : `Show all ${available.length}${hidden}`}</button>`;
    }
    html += `</section>`;
    html += upgradesHtml(settings);
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
      default:
        return "";
    }
  }
  function rowHtml(entry, best, upcoming = false) {
    const day = entry.goldPerDay;
    const sub = upcoming ? `${skillLabel(skillOf(entry))} ${entry.action.levelRequirement.level} \xB7 in ${entry.needLevels} level${entry.needLevels === 1 ? "" : "s"}${entry.hoursToUnlock !== null ? ` \xB7 ~${hoursText(entry.hoursToUnlock)}` : ""}` : `${skillLabel(skillOf(entry))} ${entry.action.levelRequirement.level}${entry.capped ? ` \xB7 ${dec(entry.hoursPerDay, 1)} h/day (sales limit)` : ""}${suggestionShort(entry.suggestion)}`;
    const warn = entry.warnings.length ? ` <span class="mwia-warn" title="${esc(entry.warnings.map(warningText).join(" "))}">\u26A0</span>` : "";
    const teaHint = !upcoming && entry.teaMode === "current" && entry.betterTeas ? `<span class="mwia-skill-hint">\u{1F375} ${teaGain(entry.best.result, entry.current)} with other teas</span>` : "";
    const gold = entry.valid ? `<span class="${day < 0 ? "mwia-bad" : best ? "mwia-ok" : ""}">${coins(day)}/day</span>` : `<span class="mwia-dim">\u2013</span>`;
    const chainHint = !upcoming && entry.chain && entry.chain.goldPerDay > entry.goldPerDay + 1 ? `<span class="mwia-skill-hint">\u26D3 ${coins(entry.chain.goldPerDay)}/day making the materials yourself</span>` : "";
    const faded = !entry.valid || day <= 0 || entry.suggestion?.count === 0 || entry.thinMargin;
    return `<details class="mwia-skill-row${best && !faded ? " mwia-best" : ""}${faded ? " mwia-faded" : ""}" data-hrid="${esc(entry.hrid)}" data-open="${esc(entry.hrid)}"${view.open.has(entry.hrid) ? " open" : ""}>
      <summary><span class="mwia-skill-name">${esc(entry.action.name)}${warn}<small>${sub}</small>${teaHint}${chainHint}</span>
        <span class="mwia-skill-nums"><b>${gold}</b><span class="mwia-dim">${coins(entry.xpPerDay)} XP/day</span></span></summary>
      <div class="mwia-skill-detail">${detailHtml(entry, upcoming)}</div></details>`;
  }
  function detailHtml(e, upcoming) {
    const section = (title, summary, body) => {
      const key = `${e.hrid}|${title}`;
      return `<details class="mwia-skill-sec" data-open="${esc(key)}"${view.open.has(key) ? " open" : ""}><summary><b>${title}</b> ${summary}</summary>${body.map((line) => `<p>${line}</p>`).join("")}</details>`;
    };
    const sections = [];
    const buttons = upcoming ? "" : actionButtons(e);
    const warnings = e.warnings.map((warning) => `<p class="mwia-warn">\u26A0 ${esc(warningText(warning))}</p>`).join("");
    const speed = e.speed ? ` \u2192 ${dec(e.cycleSeconds, 2)} s with ${pct(e.speed)} speed${e.cycleSeconds <= 3 + 1e-9 ? " (3 s is the floor)" : ""}` : "";
    const buffEfficiency = e.efficiency - e.levelEfficiency;
    sections.push(section("\u23F1 Speed", `${dec(e.actionsPerHour, 0)} actions/h`, [
      `${dec(e.baseSeconds, 1)} s${speed}. Efficiency ${pct(e.efficiency)} (levels ${pct(e.levelEfficiency)}: level ${dec(e.effectiveLevel, 0)} vs ${dec(e.requiredLevel, 0)} needed${buffEfficiency ? `, buffs ${pct(buffEfficiency)}` : ""}) \u2192 <b>${dec(e.actionsPerHour, 0)} actions/h</b>.`
    ]));
    const gold = [];
    const outputs = e.outputs.filter((o) => o.value > 0 || o.kind === "product").map((o) => {
      const capped = o.sell.capped === "usual" ? `usual ask; ${coins(o.sell.ask)} now` : o.sell.capped === "spread" ? `${dec(WIDE_SPREAD, 1)}\xD7 bid; ask ${coins(o.sell.ask)}` : o.sell.source;
      const how = o.sell.source === "ask" || o.sell.source === "bid" ? ` <span class="mwia-dim">(${capped} \u2212${dec(MARKET_TAX * 100, 0)}%)</span>` : o.sell.source === "vendor" || o.sell.source === "contents" ? ` <span class="mwia-dim">(${o.sell.source})</span>` : "";
      return `${count(o.count)} \xD7 ${esc(itemName(o.itemHrid))} @ ${coins(o.price)}${how}`;
    });
    const boosts = [e.quantity && `quantity ${pct(e.quantity)}`, e.processing && `processing ${pct(e.processing)}`].filter(Boolean).join(", ");
    gold.push(`<b>Each action gives</b>${boosts ? ` (${boosts})` : ""}: ${outputs.join(" \xB7 ")} = ${coins(e.revenuePerAction)}`);
    if (e.inputs.length) {
      const inputs = e.inputs.map((i) => `${count(i.count)} \xD7 ${esc(itemName(i.itemHrid))} @ ${i.price === null ? "\u2013" : coins(i.price)}`);
      gold.push(`<b>Each action uses</b>${e.artisan ? ` (artisan ${pct(-e.artisan)})` : ""}: ${inputs.join(" \xB7 ")} = ${coins(e.costPerAction)}`);
    }
    if (e.teas.length) {
      gold.push(`<b>Teas:</b> ${e.teaCosts.map((t3) => `${esc(itemName(t3.itemHrid))} @ ${coins(t3.price)}`).join(" \xB7 ")}, ${dec(e.drinksPerHour, 1)} of each per hour = ${coins(e.teaPerHour)}/h`);
    }
    const hours = e.capped ? ` \xD7 ${dec(e.hoursPerDay, 1)} h` : " \xD7 24";
    gold.push(`(${coins(e.revenuePerAction)} \u2212 ${coins(e.costPerAction)}) \xD7 ${dec(e.actionsPerHour, 0)}${e.teas.length ? ` \u2212 ${coins(e.teaPerHour)}` : ""} = ${coins(e.profitPerHour)}/h${hours} = <b>${coins(e.goldPerDay)}/day</b>`);
    if (e.capped) gold.push(`<span class="mwia-dim">The market takes ${coins(e.mainCount * e.actionsPerHour * e.hoursPerDay)} a day (your limit), so this runs ${dec(e.hoursPerDay, 1)} h a day; fill the rest with something else.</span>`);
    sections.push(section("\u{1F4B0} Gold", `${coins(e.profitPerHour)}/h${e.margin !== null ? ` \xB7 margin ${dec(e.margin * 100, 1)}%` : ""}`, gold));
    if (e.chain) sections.push(section("\u26D3 Yourself", `${coins(e.chain.profitPerHour)}/h making the materials`, [chainHtml(e)]));
    sections.push(section("\u2728 XP", `${coins(e.xpPerHour)}/h`, [`${dec(e.xpPerAction, 1)} per action \xD7 ${dec(e.actionsPerHour, 0)} = ${coins(e.xpPerHour)}/h${hours} = <b>${coins(e.xpPerDay)}/day</b>`]));
    if (!upcoming && e.suggestion) sections.push(section("\u{1F4E6} How many", suggestionSummary(e.suggestion), [suggestionHtml(e)]));
    if (!upcoming) sections.push(section("\u{1F375} Teas", teaSummary(e), [teaHtml(e)]));
    return buttons + warnings + sections.join("");
  }
  function chainHtml(e) {
    const c2 = e.chain;
    const shares = [`${dec(c2.craftShare * 100, 0)}% ${esc(e.action.name)}`, ...[...c2.shares].sort((a, b) => b.share - a.share).map((s) => `${dec(s.share * 100, 0)}% ${esc(itemName(s.itemHrid))} <span class="mwia-dim">(${skillLabel(s.action.type.split("/").pop())}, ${count(s.count)} each)</span>`)];
    const better = c2.profitPerHour > e.profitPerHour;
    return `Make every material your levels allow, buy the rest: <b>${coins(c2.profitPerHour)}/h = ${coins(c2.goldPerDay)}/day</b>
        <span class="${better ? "mwia-ok" : "mwia-dim"}">(${better ? "+" : "\u2212"}${coins(Math.abs(c2.goldPerDay - e.goldPerDay))}/day vs buying)</span>.
        <br>Of each hour: ${shares.join(" \xB7 ")}.${c2.bought.length ? `<br>Still bought: ${esc(names(c2.bought))}.` : ""}
        <br><span class="mwia-dim">Each step uses that skill's teas; the gold is per hour of the whole chain.</span>`;
  }
  function actionButtons(e) {
    const crafted = e.action.function === "/action_functions/production";
    const productHrid = e.action.outputItems?.[0]?.itemHrid;
    const s = e.suggestion;
    const make = crafted && s?.count ? `<button class="mwia-btn" data-action="skilling-make" data-hrid="${esc(e.hrid)}" data-count="${s.count}">\u25B6 Make ${s.count.toLocaleString("en-US")}</button>` : "";
    const plan = e.teaPlan;
    const teas = plan?.items.length ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-cart" data-teas="${esc(JSON.stringify(plan.items.map(({ hrid, quantity }) => ({ hrid, quantity }))))}" title="Adds the best teas for ${hoursText(plan.hours)} to the MWITools cart: ${esc(plan.items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", "))}">\u{1F375} Buy teas</button>` : "";
    const market = crafted ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-market" data-item="${esc(productHrid)}" title="Opens ${esc(itemName(productHrid))} on the market. Not needed for the advice; the orders you see there are shown under How many.">\u{1F3EA} Market</button>` : "";
    return make || teas || market ? `<div class="mwia-skill-buttons">${make}${teas}${market}</div>` : "";
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
    const now = (current.teas.length ? `Your teas: ${esc(names(current.teas))}.` : "You have no teas in this skill.") + ` ${slotsLine(entry)}`;
    if (!entry.betterTeas) {
      if (!best.result.teas.length) return `${now} No tea earns back its cost here.`;
      return `${now} That is already the best setup. ${worthText(best.worth)}${purchaseText(entry.teaPlan)}`;
    }
    return `${now} Best: <b>${esc(names(best.result.teas)) || "none"}</b> \u2192 ${coins(best.result.goldPerDay)}/day, ${coins(best.result.xpPerDay)} XP/day
        (<span class="mwia-ok">${teaGain(best.result, current)}</span>). ${worthText(best.worth)}${purchaseText(entry.teaPlan)}`;
  }
  function slotsLine(entry) {
    const n2 = entry.teaSlots;
    return `<span class="mwia-dim">${n2} tea slot${n2 === 1 ? "" : "s"} (${entry.pouch ? esc(itemName(entry.pouch)) : "no pouch"}).</span>`;
  }
  function worthText(worth) {
    if (!worth.length) return "";
    return worth.map((w) => w.gainPerDay >= 0 ? `${esc(itemName(w.itemHrid))} earns ${coins(w.gainPerDay)}/day more than it costs.` : `${esc(itemName(w.itemHrid))} costs ${coins(-w.gainPerDay)}/day and adds ${coins(w.xpPerDay)} XP/day.`).join(" ");
  }
  function purchaseText(plan) {
    if (!plan) return "";
    const have3 = plan.items.length ? ` To buy: ${plan.items.map((i) => `${i.quantity.toLocaleString("en-US")} ${esc(itemName(i.hrid))}${i.have ? ` (you have ${i.have.toLocaleString("en-US")})` : ""}`).join(", ")}.` : " You have enough of each.";
    return `<br>For this job (${hoursText(plan.hours)}): ${plan.perTea.toLocaleString("en-US")} of each.${have3}`;
  }
  function suggestionShort(suggestion) {
    if (!suggestion?.known) return "";
    return " \xB7 " + suggestionSummary(suggestion);
  }
  function suggestionSummary(s) {
    const rating = RATING[s.liquidity.rating] + (s.ratedBy ? " (materials)" : "");
    if (!s.count) return `${rating} \xB7 ${s.held ? "you hold enough" : "your coins don't stretch to one"}`;
    return `${rating} \xB7 make ${s.count.toLocaleString("en-US")} (${hoursText(s.hours)}) \xB7 ${coins(s.batch.materials)} in, ${s.batch.profit >= 0 ? "+" : "\u2212"}${coins(Math.abs(s.batch.profit))}`;
  }
  function liquidityText(l) {
    const share = (x) => `${Math.round(x * 100)}%`;
    if (!l.known) return `${RATING.thin}: under ${MIN_HOURS} hours of prices for it yet${l.hours ? ` (${l.hours})` : ""}, so it is treated as thin.`;
    const parts = [
      `a buyer and a seller in ${share(l.both)} of the hours`,
      `spread ${dec(l.spread * 100, 1)}%`,
      `price swings \xB1${dec(l.swing * 100, 1)}%`,
      `the lowest ask moved in ${share(l.activity)} of the hours`
    ];
    const s = LIQUIDITY.stable;
    return `${RATING[l.rating]} over the last ${l.hours} hours of prices: ${parts.join(", ")}. <span class="mwia-dim">Stable needs \u2265 ${share(s.both)}, \u2264 ${share(s.spread)}, \u2264 \xB1${share(s.swing)} and \u2265 ${share(s.activity)}. Prices only \u2013 the market file has no quantities, so a calm item that sells a few a day can still look stable.</span>`;
  }
  var ago = (at2) => hoursText((Date.now() - at2) / 36e5);
  var have = (hrid) => heldStock(state.character, state.items, hrid).inventory;
  function materialsText(s) {
    const shown = s.inputs.filter((i) => i.toBuy > 0);
    if (!shown.length) return "";
    const parts = shown.map((i) => {
      const rating = i.liquidity || { rating: "thin", known: false };
      let text = `${i.toBuy.toLocaleString("en-US")} ${esc(itemName(i.itemHrid))} ${RATING[rating.rating]}${rating.known ? "" : " (too little history)"}`;
      if (i.bookAt) text += ` \u2013 ${i.nearAsks.toLocaleString("en-US")} listed near the lowest ask ${ago(i.bookAt)} ago`;
      else if (rating.rating !== "stable") text += ` \u2013 <i>open it on the market to see how many are for sale</i>`;
      return i.itemHrid === s.ratedBy || i.itemHrid === s.limitedByBook ? `<span class="mwia-warn">${text}</span>` : text;
    });
    const by = s.ratedBy ? ` <span class="mwia-dim">The coins follow the thinnest market: ${esc(itemName(s.ratedBy))}.</span>` : "";
    return `To buy: ${parts.join(" \xB7 ")}.${by}`;
  }
  function suggestionHtml(e) {
    const s = e.suggestion;
    const product = esc(itemName(e.action.outputItems[0].itemHrid));
    const lines = [liquidityText(s.productLiquidity)];
    let plan = `A ${hoursText(s.plannedHours)} job is ${s.plannedUnits.toLocaleString("en-US")} ${product}${s.cappedBySales ? " (your <i>Max sold/day</i>)" : ""}`;
    if (s.held) plan += ` \u2212 ${s.held.toLocaleString("en-US")} you already have (${s.stock.inventory.toLocaleString("en-US")} in inventory, ${s.stock.listed.toLocaleString("en-US")} listed)`;
    lines.push(plan + ".");
    const sw = s.swing;
    if (sw && sw.share < 1) {
      const why = [];
      if (sw.bySwing < 1) why.push(`its price usually swings \xB1${Math.round(sw.swing * 100)}%`);
      if (sw.high) why.push(`it is ${Math.round(sw.diff * 100)}% above its usual price now \u2013 sell it while it lasts`);
      lines.push(`Made ${Math.round(sw.share * 100)}% of that: ${why.join(", and ")}.`);
    }
    if (sw?.low) lines.push(`<span class="mwia-warn">It sells ${Math.round(-sw.diff * 100)}% below its usual price now \u2013 waiting, or making something else, may pay.</span>`);
    const budget = `${Math.round(s.coinShare * 100)}% of your coins (${coins(s.budget)}) for a ${s.liquidity.rating} market`;
    if (s.limitedByCoins) lines.push(`<span class="mwia-warn">Materials capped at ${budget}.</span>`);
    else lines.push(`<span class="mwia-dim">Materials may take up to ${budget}.</span>`);
    const materials = materialsText(s);
    if (materials) lines.push(materials);
    if (s.limitedByBook) {
      const input = s.inputs.find((i) => i.itemHrid === s.limitedByBook);
      lines.push(`<span class="mwia-warn">Capped at the ${esc(itemName(input.itemHrid))} you can get: ${input.nearAsks.toLocaleString("en-US")} listed within ${dec(ASK_WINDOW * 100, 0)}% of the lowest ask ${ago(input.bookAt)} ago${have(input.itemHrid) ? `, plus ${have(input.itemHrid).toLocaleString("en-US")} you have` : ""}.</span>`);
    }
    if (s.bookAt) {
      const age = ago(s.bookAt);
      const seen = [s.profitableBids !== null && `${s.profitableBids.toLocaleString("en-US")} in buy orders at \u2265 ${coins(s.breakEven)} (break-even)`, s.nearAsks !== null && `${s.nearAsks.toLocaleString("en-US")} listed by others within ${dec(ASK_WINDOW * 100, 0)}% of the lowest ask`].filter(Boolean);
      if (seen.length) lines.push(`<span class="mwia-dim">On the market ${age} ago: ${seen.join(" \xB7 ")}.</span>`);
    }
    if (!s.count) return lines.join("<br>") + (s.held ? " You already hold enough \u2013 nothing to make." : " Not enough coins for one.");
    lines.push(`\u2192 <b>make ${s.count.toLocaleString("en-US")}</b> (${hoursText(s.hours)}).`);
    const b = s.batch;
    const owned = b.materials - b.toBuy;
    lines.push(`<b>This batch:</b> materials ${coins(b.materials)}${owned > 1 ? ` (you buy ${coins(b.toBuy)}; ${coins(owned)} worth is already in your inventory)` : ""}${b.teas > 1 ? `, teas ${coins(b.teas)}` : ""}.
        It sells for ${coins(b.revenue)} after tax \u2192 <b class="${b.profit >= 0 ? "mwia-ok" : "mwia-bad"}">${b.profit >= 0 ? "+" : "\u2212"}${coins(Math.abs(b.profit))}</b>.
        <span class="mwia-dim">The coins come back as the items sell, so a slow seller ties them up for a while.</span>`);
    return lines.join("<br>");
  }
  var INVENTORY3 = "/item_locations/inventory";
  function upgradeRanking(settings) {
    var _a;
    const skill = settings.skillingSkill;
    const key = [state.updatedAt, pricesStamp(), skill, settings.skillingSellAt, settings.skillingSellCap].join("|");
    if (view.upgradesKey !== key) {
      const data = getClientData();
      const equipped = {};
      const owned = {};
      for (const item of state.items.values()) {
        if (!item.itemHrid) continue;
        if (item.itemLocationHrid === INVENTORY3) (owned[_a = item.itemHrid] || (owned[_a] = [])).push(item.enhancementLevel || 0);
        else equipped[item.itemLocationHrid] = { itemHrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 };
      }
      const houseLevels = {};
      for (const [hrid, room] of Object.entries(state.character.characterHouseRoomMap || {})) houseLevels[hrid] = room.level || 0;
      view.upgrades = rankUpgrades(skillingCharacter(state.character, state.items, data), data, skillingMarket(settings.skillingSellAt), skill, {
        equipped,
        owned,
        listings: (hrid) => marketListings(hrid),
        houseLevels,
        sellCap: Number(settings.skillingSellCap) || 0,
        gameEquipmentBuffs: state.character.equipmentActionTypeBuffsMap || null
      });
      view.upgradesKey = key;
    }
    return view.upgrades;
  }
  function upgradesHtml(settings) {
    if (settings.skillingSkill === "all") {
      return `<section><h3>Upgrades that pay back</h3><p class="mwia-dim">Pick a skill above to see which tools, clothes, jewellery and house rooms pay for themselves.</p></section>`;
    }
    const { base, upgrades, check } = upgradeRanking(settings);
    let html = `<section><h3>Upgrades that pay back</h3>`;
    if (!base) return html + `<p class="mwia-dim">Nothing in this skill earns gold at your level yet.</p></section>`;
    html += `<p class="mwia-dim">Each tried in place of what you wear now, measured on the skill's best action (now ${esc(base.action.name)}, ${coins(base.goldPerDay)}/day). Payback = price \xF7 extra gold a day.</p>`;
    if (check && !check.matches) {
      html += `<div class="mwia-notice mwia-notice-warn">Your gear's action speed here is ${pct(check.game)} by the game but ${pct(check.mine)} by the item stats, so these numbers may be a little off.</div>`;
    }
    if (!upgrades.length) return html + `<p class="mwia-dim">Nothing for sale would earn more here.</p></section>`;
    html += `<div class="mwia-upgrade-list">${upgrades.slice(0, UPGRADES_SHOWN).map(upgradeRowHtml).join("")}</div></section>`;
    return html;
  }
  function upgradeRowHtml(u) {
    const payback = u.paybackDays === null ? "price unknown" : u.paybackDays === 0 ? "free \u2013 you own it" : `pays back in ${hoursText(u.paybackDays * 24)}`;
    const gain = `+${coins(u.gainPerDay)}/day${u.xpPerDay > 1 ? `, +${coins(u.xpPerDay)} XP/day` : ""}`;
    if (u.kind === "house") {
      const cart2 = u.materials.filter((m) => m.itemHrid !== "/items/coin").map((m) => ({ hrid: m.itemHrid, quantity: m.count }));
      const coinsNeeded = u.materials.find((m) => m.itemHrid === "/items/coin")?.count || 0;
      return `<div class="mwia-upgrade"><div><b>\u{1F3E0} ${esc(u.name)} \u2192 level ${u.level}</b> <span class="mwia-dim">${u.price === null ? "" : coins(u.price)}</span>
            <small>${gain} \xB7 ${payback}${coinsNeeded ? ` \xB7 incl. ${coins(coinsNeeded)} coins` : ""}</small></div>
            ${cart2.length ? `<button class="mwia-cart-btn" data-action="skilling-cart" data-teas="${esc(JSON.stringify(cart2))}" title="Adds the materials to the MWITools cart">\u{1F6D2} Materials</button>` : ""}</div>`;
    }
    const name = `${esc(itemName(u.itemHrid))}${u.enhancementLevel ? ` <span class="mwia-enh">+${u.enhancementLevel}</span>` : ""}`;
    const replaces = u.replaces ? `replaces ${esc(itemName(u.replaces.itemHrid))}${u.replaces.enhancementLevel ? ` +${u.replaces.enhancementLevel}` : ""}` : "empty slot";
    const cart = u.owned ? "" : `<button class="mwia-cart-btn" data-action="skilling-cart" data-teas="${esc(JSON.stringify([{ hrid: u.itemHrid, quantity: 1, enhancementLevel: u.enhancementLevel }]))}" title="Adds it to the MWITools cart">\u{1F6D2} Add</button>`;
    return `<div class="mwia-upgrade"><div><b>${name}</b> <span class="mwia-dim">${u.owned ? "you own it" : coins(u.price)}</span>
        <small>${gain} \xB7 ${payback} \xB7 ${replaces}${slotsText(u)}</small></div>${cart}</div>`;
  }
  function slotsText(u) {
    if (!u.extraSlots) return "";
    const slots = `${u.extraSlots > 0 ? "+" : ""}${u.extraSlots} tea slot${Math.abs(u.extraSlots) === 1 ? "" : "s"}`;
    return ` \xB7 ${slots}${u.teas?.length ? ` (with ${esc(names(u.teas))} on ${esc(u.bestAction.name)})` : ""}`;
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
  function clickTab(label) {
    if (!label) return false;
    const tab = [...document.querySelectorAll(TABS)].filter(visible).find((candidate) => clean(candidate.textContent) === label);
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
  function callReactHandler(names2, args) {
    const fibers = [];
    const root = document.getElementById("root");
    for (const element of [root, document.querySelector('[class*="GamePage_gamePage"]')]) {
      for (const key of Object.getOwnPropertyNames(element || {})) {
        if (/^__react(Container|Fiber|InternalInstance)\$/.test(key)) fibers.push(element[key]?.current ?? element[key]);
      }
    }
    const roots = fibers.length;
    const visited = /* @__PURE__ */ new Set();
    while (fibers.length && visited.size < 5e4) {
      const fiber = fibers.pop();
      if (!fiber || visited.has(fiber)) continue;
      visited.add(fiber);
      const instance = fiber.stateNode;
      for (const handler of names2) {
        if (instance && typeof instance[handler] === "function") {
          try {
            instance[handler](...args);
            return `react: ${handler} called`;
          } catch {
          }
        }
      }
      if (fiber.return) fibers.push(fiber.return);
      if (fiber.child) fibers.push(fiber.child);
      if (fiber.sibling) fibers.push(fiber.sibling);
    }
    return `react: no handler (roots ${roots}, fibers ${visited.size})`;
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
  function openMarketplace(win2, itemHrid) {
    try {
      const api = win2.MWITools?.shopping;
      if (typeof api?.openMarketplace === "function" && api.openMarketplace(itemHrid, 0)) return true;
    } catch {
    }
    return /called/.test(callReactHandler(["handleGoToMarketplace"], [itemHrid, 0]));
  }

  // src/price-history-ui.js
  var CURRENT_ITEM = '[class*="MarketplacePanel_currentItem"]';
  var FIRST_COLLECT_MS = 15 * 1e3;
  var SCAN_MS = 400;
  var RANGES = [30, 365];
  var PRELIMINARY_HOURS = 2;
  var h = { win: null, scanTimer: null, scanning: false, range: 30, open: false, listeners: /* @__PURE__ */ new Set(), exported: null, status: "" };
  var pct2 = (fraction) => `${fraction >= 0 ? "+" : "\u2212"}${Math.abs(fraction * 100).toFixed(0)}%`;
  function onHistoryChange(listener) {
    h.listeners.add(listener);
  }
  function startPriceHistory(win2) {
    h.win = win2;
    onPricesLoaded((marketData, timestamp) => {
      recordSnapshot(marketData, timestamp).then((added) => {
        if (!added) return;
        scheduleScan(true);
        for (const listener of h.listeners) listener();
      }).catch((error) => console.warn("[Combat Advisor] price history", error));
    });
    loadHistory().catch((error) => console.warn("[Combat Advisor] price history", error));
    const collect = () => loadPrices(true).catch(() => {
    });
    setTimeout(collect, FIRST_COLLECT_MS);
    setInterval(collect, COLLECT_EVERY_MS);
    new MutationObserver(() => scheduleScan()).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("toggle", (event) => {
      if (!event.target.matches?.(".mwia-history-more") || event.target.open === h.open) return;
      h.open = event.target.open;
      scheduleScan(true);
    }, true);
  }
  function scheduleScan(force = false) {
    if (force) document.querySelectorAll(".mwia-history").forEach((box) => box.dataset.version = "");
    if (h.scanTimer) return;
    h.scanTimer = setTimeout(async () => {
      h.scanTimer = null;
      if (h.scanning) return scheduleScan();
      h.scanning = true;
      try {
        await scan();
      } finally {
        h.scanning = false;
      }
    }, SCAN_MS);
  }
  function currentItem() {
    const node = [...document.querySelectorAll(CURRENT_ITEM)].find(visible);
    const href = node?.querySelector("svg use")?.getAttribute("href") || node?.querySelector("svg use")?.getAttribute("xlink:href") || "";
    const id = href.split("#")[1];
    return node && id ? { node, itemHrid: "/items/" + id } : null;
  }
  function fullWidthRow(node) {
    const panel = node.closest('[class*="MarketplacePanel_marketplacePanel"]') || document.body;
    const width = panel.getBoundingClientRect().width;
    let row = node;
    while (row.parentElement && row.parentElement !== panel && row.getBoundingClientRect().width < 0.8 * width) row = row.parentElement;
    return row;
  }
  async function scan() {
    const current = currentItem();
    document.querySelectorAll(".mwia-history").forEach((box2) => {
      if (!current || box2.dataset.item !== current.itemHrid || !document.contains(box2)) box2.remove();
    });
    if (!current) return;
    let box = document.querySelector(".mwia-history");
    const key = `${current.itemHrid}|${h.range}|${h.open}|${h.exported ? "ready" : ""}|${h.status}`;
    if (box && box.dataset.version === key) return;
    if (!box) {
      box = document.createElement("div");
      box.className = "mwia-history";
      fullWidthRow(current.node).insertAdjacentElement("beforebegin", box);
    }
    box.dataset.item = current.itemHrid;
    box.dataset.version = key;
    box.innerHTML = await historyHtml(current.itemHrid);
  }
  function exportHtml() {
    const e = h.exported;
    const buttons = e ? `<span>${e.items} items \xB7 ${e.hours} hours \xB7 ${e.days} days \xB7 ${(e.csv.length / 1024).toFixed(0)} kB</span>
           <button data-history-export="download">\u2B07 Download CSV</button><button data-history-export="copy">\u{1F4CB} Copy</button>` : `<button data-history-export="prepare">\u2B07 Export all prices</button>`;
    return `<div class="mwia-history-ranges mwia-history-export">${buttons}</div>${h.status ? `<div class="mwia-history-note">${esc(h.status)}</div>` : ""}`;
  }
  async function onExport(kind) {
    if (kind === "prepare") {
      h.status = "Preparing\u2026";
      scheduleScan(true);
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
    scheduleScan(true);
  }
  function onClick(event) {
    const exportButton = event.target.closest?.(".mwia-history [data-history-export]");
    if (exportButton) {
      event.preventDefault();
      event.stopPropagation();
      onExport(exportButton.dataset.historyExport);
      return;
    }
    const button = event.target.closest?.(".mwia-history [data-range]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    h.range = Number(button.dataset.range);
    scheduleScan(true);
  }
  async function historyHtml(itemHrid) {
    await loadHistory();
    const summary = priceSummary(itemHrid);
    const entry = marketEntry(itemHrid);
    const head2 = (text) => `<div class="mwia-history-head"><b>\u{1F4C8} Usual price</b> <span>${text}</span></div>`;
    const saved = `<div class="mwia-history-note">Saved every 30 min while the game is open, on this device.</div>`;
    const more = (title, body) => `<details class="mwia-history-more"${h.open ? " open" : ""}><summary>${title}</summary>${body}${exportHtml()}</details>`;
    if (!summary || summary.hours7 < PRELIMINARY_HOURS) {
      return head2(`collecting: ${summary ? progressText(summary) : "nothing yet"}`) + more("Export", saved);
    }
    const versusText = (now, side) => {
      const versus = versusUsual(now, side.med7);
      const cls = !versus ? "" : versus.label === "above" ? "mwia-history-high" : versus.label === "below" ? "mwia-history-low" : "";
      return versus ? `<span class="${cls}">${pct2(versus.diff)} ${versus.label === "near" ? "usual" : versus.label}</span>` : "";
    };
    const row = (label, now, side) => `<tr><th>${label}</th><td>${now > 0 ? shortCoins(now) : "\u2013"}</td>
            <td>${side.med7 ? shortCoins(side.med7) : "\u2013"} ${versusText(now, side)}</td>
            <td>${side.med30 ? shortCoins(side.med30) : "\u2013"}</td><td>${trendArrow(side.trend)}</td></tr>`;
    const askNow = entry?.a > 0 ? entry.a : null;
    const bidNow = entry?.b > 0 ? entry.b : null;
    const brief = (label, now, side) => `${label} <b>${now > 0 ? shortCoins(now) : "\u2013"}</b> ${versusText(now, side)}${trendArrow(side.trend) ? " " + trendArrow(side.trend) : ""}`;
    const swing = summary.a.swing ?? summary.b.swing;
    const line = `<div class="mwia-history-sum">${brief("Ask", askNow, summary.a)} \xB7 ${brief("Bid", bidNow, summary.b)}${swing !== null ? ` \xB7 <span title="Half of the week's prices lie within this share of the 7-day median">swings \xB1${Math.round(swing * 100)}%</span>` : ""}</div>`;
    const points = h.open ? await priceSeries(itemHrid, h.range) : [];
    const long = h.open && h.range > 31 ? await longMedians(itemHrid) : null;
    const longLine = long?.days ? `<div class="mwia-history-note">90 days: ask ${long.a90 ? shortCoins(long.a90) : "\u2013"}, bid ${long.b90 ? shortCoins(long.b90) : "\u2013"} \xB7 1 year: ask ${long.a365 ? shortCoins(long.a365) : "\u2013"}, bid ${long.b365 ? shortCoins(long.b365) : "\u2013"} (${long.days} days of data)</div>` : "";
    const preliminary = !summary.enough;
    return (preliminary ? head2(`<b class="mwia-history-prelim">preliminary</b> \xB7 ${readyText(summary)}`) : head2(`7-day median \xB7 ${summary.spanDays.toFixed(0)} days of data`)) + line + more(
      "Chart and details",
      `<table class="mwia-history-table"><tr><th></th><th>Now</th><th>7 days</th><th>30 days</th><th>Trend</th></tr>${row("Ask", askNow, summary.a)}${row("Bid", bidNow, summary.b)}</table>` + chartSvg(points) + `<div class="mwia-history-ranges">${RANGES.map((r) => `<button data-range="${r}" class="${r === h.range ? "mwia-active" : ""}">${r === 365 ? "1 y" : `${r} d`}</button>`).join("")}
          <span><i class="mwia-history-ask"></i>ask <i class="mwia-history-bid"></i>bid</span></div>` + longLine + (preliminary ? `<div class="mwia-history-note">Preliminary: ${progressText(summary)}. Only ${summary.hours7} h over ${summary.spanDays.toFixed(1)} days, so one odd day can still move it. The Skilling tab warns only once it is ready.</div>` : `<div class="mwia-history-note">${summary.hours7} h in the last week.</div>`) + saved
    );
  }
  function readyText(summary) {
    const parts = progressText(summary).split(" \xB7 ");
    return parts.length > 2 ? parts.slice(2).join(" \xB7 ") : "almost ready";
  }
  function progressText(summary) {
    const hoursLeft = Math.max(0, MIN_HOURS - summary.hours7);
    const daysLeft = Math.max(0, MIN_DAYS - summary.spanDays);
    const parts = [
      hoursLeft ? `${summary.hours7} of ${MIN_HOURS} h` : `${MIN_HOURS} h \u2713`,
      daysLeft ? `${summary.spanDays.toFixed(1)} of ${MIN_DAYS} days` : `${MIN_DAYS} days \u2713`
    ];
    if (daysLeft) {
      const wait = daysLeft * 24;
      parts.push(`ready in about ${wait < 20 ? Math.max(1, Math.round(wait)) + " h" : Math.round(daysLeft * 10) / 10 + " day" + (daysLeft > 1.05 ? "s" : "")}${hoursLeft ? ` and ${hoursLeft} more h with the game open` : ""}`);
    } else if (hoursLeft) {
      parts.push(`${hoursLeft} more h with the game open`);
    }
    return parts.join(" \xB7 ");
  }
  function chartSvg(points) {
    if (points.length < 2) return "";
    const W = 300;
    const H = 64;
    const values = points.flatMap((p) => [p.a, p.b]).filter(Number.isFinite);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const t0 = points[0].t;
    const span = Math.max(1, points[points.length - 1].t - t0);
    const x = (t3) => (t3 - t0) / span * (W - 4) + 2;
    const y = (v) => high === low ? H / 2 : H - 4 - (v - low) / (high - low) * (H - 8);
    const line = (key, cls) => {
      const path = points.filter((p) => Number.isFinite(p[key])).map((p) => `${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
      return path ? `<polyline class="${cls}" points="${path}"/>` : "";
    };
    return `<svg class="mwia-history-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${line("b", "mwia-history-bid")}${line("a", "mwia-history-ask")}</svg>
        <div class="mwia-history-scale"><span>${esc(shortCoins(low))}</span><span>${esc(shortCoins(high))}</span></div>`;
  }

  // src/consumable-guide.js
  var SCAN_MS2 = 400;
  var COMBAT2 = "/action_types/combat";
  var SETUPS_KEY = "mwia-combat-setups";
  var HOURS_PER_DAY2 = 24;
  var g = { deps: null, scanTimer: null, loading: null, statuses: /* @__PURE__ */ new Map() };
  var coins2 = (n2) => (n2 < 0 ? "\u2212" : "") + shortCoins(Math.abs(n2));
  var have2 = (hrid) => state.character ? heldStock(state.character, state.items, hrid).inventory : 0;
  var slotItems = (map, type) => (state.character?.[map]?.[type] || []).map((slot) => slot?.itemHrid).filter(Boolean);
  function rememberCombatSetup(zone, setup) {
    const all = combatSetups();
    all[zone.zoneHrid] = { ...setup, tier: zone.tier || 0, at: Date.now() };
    try {
      localStorage.setItem(SETUPS_KEY, JSON.stringify(all));
    } catch {
    }
    scheduleScan2();
  }
  function combatSetups() {
    try {
      return JSON.parse(localStorage.getItem(SETUPS_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }
  function startConsumableGuide(deps) {
    g.deps = deps;
    onStateChange(() => scheduleScan2());
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(".mwia-guide-box"))) return;
      scheduleScan2();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick2, true);
  }
  function scheduleScan2() {
    if (g.scanTimer) return;
    g.scanTimer = setTimeout(() => {
      g.scanTimer = null;
      try {
        scan2();
      } catch (error) {
        console.warn("[Combat Advisor] action window", error);
      }
    }, SCAN_MS2);
  }
  function actionByName(name) {
    const data = getClientData();
    if (!data || !name) return null;
    return Object.values(data.actionDetailMap).find((action) => action.name === name && (action.type === COMBAT2 || action.levelRequirement)) || null;
  }
  function scan2() {
    const shown = /* @__PURE__ */ new Set();
    const panels = openActionPanels();
    if (panels.length && (!getClientData() || !pricesStamp())) {
      g.loading || (g.loading = g.deps.prepare().then(scheduleScan2, (error) => console.warn("[Combat Advisor] action window", error)).finally(() => g.loading = null));
      return;
    }
    for (const { panel, name, buttons } of panels) {
      const action = actionByName(name);
      if (!action) continue;
      const html = action.type === COMBAT2 ? combatHtml(action) : skillingHtml(action);
      if (!html) continue;
      let box = panel.querySelector(".mwia-guide-box");
      if (!box) {
        box = document.createElement("div");
        box.className = "mwia-guide-box";
        if (buttons) buttons.insertAdjacentElement("beforebegin", box);
        else panel.appendChild(box);
      }
      shown.add(box);
      const status = g.statuses.get(action.hrid);
      const full = html + (status ? `<div class="mwia-guide-status">${esc(status)}</div>` : "");
      if (box.dataset.action !== action.hrid || box.dataset.html !== full) {
        box.dataset.action = action.hrid;
        box.dataset.html = full;
        box.innerHTML = full;
      }
    }
    document.querySelectorAll(".mwia-guide-box").forEach((box) => shown.has(box) || box.remove());
  }
  var head = (title, note) => `<div class="mwia-guide-head"><b>${title}</b> <span>${note}</span></div>`;
  function itemLine(kind, hrid, extra = "") {
    const mark = { keep: "\u2713", add: "\u2795 Put in", remove: "\u2796 Take out" }[kind];
    return `<li class="mwia-guide-${kind}">${mark} ${esc(itemName(hrid))}${extra ? ` <span>${extra}</span>` : ""}</li>`;
  }
  function cartButton(items, label) {
    if (!items.length) return "";
    const title = items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", ");
    return `<button class="mwia-guide-cart" data-guide-cart="${esc(JSON.stringify(items))}" title="Adds to the MWITools cart: ${esc(title)}">${label}</button>`;
  }
  function skillingHtml(action) {
    const settings = g.deps.settings();
    const entry = state.character ? skillingAdvice(action.hrid, settings) : null;
    if (!entry) return "";
    const best = entry.betterTeas ? entry.best.result.teas : entry.current.teas;
    const current = entry.current.teas;
    const worth = new Map(entry.best.worth.map((w) => [w.itemHrid, w]));
    const perDay2 = Math.ceil(entry.best.result.drinksPerHour * HOURS_PER_DAY2);
    const gain = (hrid) => {
      const w = worth.get(hrid);
      if (!w) return "";
      return w.gainPerDay >= 0 ? ` \xB7 +${coins2(w.gainPerDay)}/day` : ` \xB7 +${coins2(w.xpPerDay)} XP/day`;
    };
    const stock = (hrid) => {
      const n2 = have2(hrid);
      return n2 < perDay2 ? `<b class="mwia-guide-low">${n2.toLocaleString("en-US")} in inventory</b>` : `${n2.toLocaleString("en-US")} in inventory`;
    };
    const lines = [
      ...best.map((hrid) => itemLine(current.includes(hrid) ? "keep" : "add", hrid, stock(hrid) + gain(hrid))),
      ...current.filter((hrid) => !best.includes(hrid)).map((hrid) => itemLine("remove", hrid))
    ];
    const verdict = !entry.betterTeas ? best.length ? "\u2713 Your teas are the best ones for this." : current.length ? "No tea earns back its cost here." : "\u2713 No tea earns back its cost here." : `Best teas: <b class="mwia-ok">${entry.best.result.goldPerDay >= entry.current.goldPerDay ? `+${coins2(entry.best.result.goldPerDay - entry.current.goldPerDay)}/day` : `+${coins2(entry.best.result.xpPerDay - entry.current.xpPerDay)} XP/day`}</b> over the ones in your slots now.`;
    const plan = entry.teaPlan;
    const items = plan?.items.length ? plan.items.map(({ hrid, quantity }) => ({ hrid, quantity })) : best.filter((hrid) => have2(hrid) < perDay2).map((hrid) => ({ hrid, quantity: perDay2 - have2(hrid) }));
    const label = plan?.items.length ? `\u{1F6D2} Teas for ${plan.hours < 1 ? Math.max(1, Math.round(plan.hours * 60)) + " min" : Math.round(plan.hours * 10) / 10 + " h"}` : "\u{1F6D2} Teas for 1 day";
    const focus = Number(settings.skillingGold ?? 100);
    return head("\u{1F375} Teas", `Combat Advisor \xB7 ${focus === 100 ? "gold" : focus === 0 ? "XP" : `${100 - focus}% XP \xB7 ${focus}% gold`}`) + (lines.length ? `<ul class="mwia-guide-list">${lines.join("")}</ul>` : "") + `<div class="mwia-guide-note">${verdict} ${slotsLine(entry)}</div>` + cartButton(items, label);
  }
  function combatHtml(action) {
    const setup = combatSetups()[action.hrid];
    if (!setup) {
      return head("\u2615 Drinks and food", "Combat Advisor") + `<div class="mwia-guide-note">No advice for ${esc(action.name)} yet: in the advisor, pick it as the zone under <b>Upgrades</b> and press <b>Analyze upgrades</b>.</div>`;
    }
    const hours = Math.max(0, (Date.now() - setup.at) / 36e5);
    const age = hours < 1 ? "less than an hour ago" : hours < 48 ? `${Math.round(hours)} h ago` : `${Math.round(hours / 24)} days ago`;
    const perDay2 = (hrid) => Math.ceil((setup.perHour?.[hrid] || 0) * HOURS_PER_DAY2);
    const stock = (hrid) => {
      const n2 = have2(hrid);
      const need = perDay2(hrid);
      const text = `${n2.toLocaleString("en-US")} in inventory${need ? `, ${need.toLocaleString("en-US")} a day` : ""}`;
      return n2 < need ? `<b class="mwia-guide-low">${text}</b>` : text;
    };
    const part = (title, target, current) => {
      const wanted = target.filter(Boolean);
      const lines = [...wanted.map((hrid) => itemLine(current.includes(hrid) ? "keep" : "add", hrid, stock(hrid))), ...current.filter((hrid) => !wanted.includes(hrid)).map((hrid) => itemLine("remove", hrid))];
      return lines.length ? `<div class="mwia-guide-sub">${title}</div><ul class="mwia-guide-list">${lines.join("")}</ul>` : "";
    };
    const drinksNow = slotItems("actionTypeDrinkSlotsMap", COMBAT2);
    const foodNow = slotItems("actionTypeFoodSlotsMap", COMBAT2);
    const all = [...setup.drinks, ...setup.food].filter(Boolean);
    const done2 = all.every((hrid) => drinksNow.includes(hrid) || foodNow.includes(hrid)) && [...drinksNow, ...foodNow].every((hrid) => all.includes(hrid));
    const items = all.filter((hrid) => have2(hrid) < perDay2(hrid)).map((hrid) => ({ hrid, quantity: perDay2(hrid) - have2(hrid) }));
    return head("\u2615 Drinks and food", `Combat Advisor \xB7 ${esc(actionName(action.hrid))}${setup.tier ? ` T${setup.tier}` : ""}, analysed ${age}`) + part("Drinks", setup.drinks, drinksNow) + part("Food", setup.food, foodNow) + `<div class="mwia-guide-note">${done2 ? "\u2713 Your slots match the advice." : "Set your slots as above before you start."}</div>` + cartButton(items, "\u{1F6D2} What's missing for 1 day");
  }
  async function onClick2(event) {
    const button = event.target.closest?.(".mwia-guide-box [data-guide-cart]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const actionHrid = button.closest(".mwia-guide-box").dataset.action;
    const label = (list) => list.map((i) => itemName(i.hrid)).join(", ");
    try {
      const outcome = await g.deps.addToCart(JSON.parse(button.dataset.guideCart));
      const parts = [];
      if (outcome.added.length) parts.push(`added ${label(outcome.added)}`);
      if (outcome.updated.length) parts.push(`topped up ${label(outcome.updated)}`);
      if (outcome.present.length) parts.push(`${label(outcome.present)} already in the cart`);
      if (outcome.failed.length) parts.push(`could not add ${label(outcome.failed)}`);
      g.statuses.set(actionHrid, "Cart: " + parts.join("; ") + ".");
    } catch (error) {
      g.statuses.set(actionHrid, error.message);
    }
    scheduleScan2();
  }

  // src/tool-notice.js
  var SCAN_MS3 = 400;
  var INVENTORY4 = "/item_locations/inventory";
  var GRID_ICONS = 8;
  var t = { deps: null, scanTimer: null, loading: null, key: "", notices: [], status: "" };
  var coins3 = (n2) => (n2 < 0 ? "\u2212" : "") + shortCoins(Math.abs(n2));
  var skillLabel2 = (skill) => skill.charAt(0).toUpperCase() + skill.slice(1);
  function startToolNotice(deps) {
    t.deps = deps;
    onStateChange(() => scheduleScan3());
    new MutationObserver((records) => {
      if (records.every((r) => r.target.closest?.(".mwia-tool-box"))) return;
      scheduleScan3();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick3, true);
  }
  function scheduleScan3() {
    if (t.scanTimer) return;
    t.scanTimer = setTimeout(() => {
      t.scanTimer = null;
      try {
        scan3();
      } catch (error) {
        console.warn("[Combat Advisor] tool notice", error);
      }
    }, SCAN_MS3);
  }
  function equipmentGrid() {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "View Stats" && visible(b));
    for (let node = button?.parentElement; node && node !== document.body; node = node.parentElement) {
      if (node.querySelectorAll("use").length >= GRID_ICONS) return node;
    }
    return null;
  }
  function notices() {
    var _a;
    const settings = t.deps.settings();
    const key = [state.updatedAt, pricesStamp(), settings.skillingSellAt, settings.skillingSellCap].join("|");
    if (t.key !== key) {
      const data = getClientData();
      const equipped = {};
      const owned = {};
      for (const item of state.items.values()) {
        if (!item.itemHrid) continue;
        if (item.itemLocationHrid === INVENTORY4) (owned[_a = item.itemHrid] || (owned[_a] = [])).push(item.enhancementLevel || 0);
        else equipped[item.itemLocationHrid] = { itemHrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 };
      }
      const who = skillingCharacter(state.character, state.items, data);
      const market = skillingMarket(settings.skillingSellAt);
      t.notices = toolTiers(who, data, market, { equipped, owned, sellCap: Number(settings.skillingSellCap) || 0 });
      t.key = key;
    }
    return t.notices;
  }
  function scan3() {
    const grid = state.character ? equipmentGrid() : null;
    if (grid && (!getClientData() || !pricesStamp())) {
      t.loading || (t.loading = t.deps.prepare().then(scheduleScan3, (error) => console.warn("[Combat Advisor] tool notice", error)).finally(() => t.loading = null));
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
  function cartButton2(items, label) {
    return `<button class="mwia-guide-cart" data-tool-cart="${esc(JSON.stringify(items))}" title="Adds to the MWITools cart: ${esc(items.map((i) => itemName(i.hrid)).join(", "))}">${label}</button>`;
  }
  function rowHtml2(n2) {
    const from = n2.current ? `${esc(itemName(n2.current.itemHrid))}${n2.current.enhancementLevel ? ` +${n2.current.enhancementLevel}` : ""} \u2192 ` : "";
    let worth = "";
    if (n2.gainPerDay !== null) {
      if (n2.gainPerDay > 1) worth = ` \xB7 <span class="mwia-ok">+${coins3(n2.gainPerDay)}/day</span>${n2.paybackDays !== null && !n2.owned ? `, pays back in ${n2.paybackDays < 1 ? Math.max(1, Math.round(n2.paybackDays * 24)) + " h" : Math.round(n2.paybackDays * 10) / 10 + " days"}` : ""}`;
      else if (n2.xpPerDay > 1) worth = ` \xB7 +${coins3(n2.xpPerDay)} XP/day`;
      else if (n2.current) worth = ` \xB7 <span class="mwia-guide-low">not better than your ${esc(itemName(n2.current.itemHrid))}${n2.current.enhancementLevel ? ` +${n2.current.enhancementLevel}` : ""}</span>`;
    }
    const price = n2.owned ? "in your inventory \u2013 equip it" : n2.price === null ? "nobody sells it now" : coins3(n2.price);
    const cart = !n2.owned && n2.price !== null ? cartButton2([{ hrid: n2.itemHrid, quantity: 1 }], "\u{1F6D2}") : "";
    return `<li><span><b>${skillLabel2(n2.skill)}</b> <span class="mwia-dim">lvl ${n2.skillLevel}</span>: ${from}<b>${esc(itemName(n2.itemHrid))}</b> <span class="mwia-dim">(lvl ${n2.level})</span> \xB7 ${price}${worth}</span>${cart}</li>`;
  }
  function boxHtml(list) {
    const buyable = list.filter((n2) => !n2.owned && n2.price !== null);
    return `<div class="mwia-guide-head"><b>\u2B06 Better tools unlocked</b> <span>Combat Advisor</span></div>
        <ul class="mwia-tool-list">${list.map(rowHtml2).join("")}</ul>
        ${buyable.length > 1 ? cartButton2(buyable.map((n2) => ({ hrid: n2.itemHrid, quantity: 1 })), `\u{1F6D2} Add all ${buyable.length} (${coins3(buyable.reduce((sum, n2) => sum + n2.price, 0))})`) : ""}
        ${t.status ? `<div class="mwia-guide-status">${esc(t.status)}</div>` : ""}
        <div class="mwia-guide-status">Gold a day on the skill's best action now, sold at the ${t.deps.settings().skillingSellAt === "bid" ? "bid" : "ask"}.</div>`;
  }
  async function onClick3(event) {
    const button = event.target.closest?.(".mwia-tool-box [data-tool-cart]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const names2 = (list) => list.map((i) => itemName(i.hrid)).join(", ");
    try {
      const outcome = await t.deps.addToCart(JSON.parse(button.dataset.toolCart));
      const parts = [];
      if (outcome.added.length) parts.push(`added ${names2(outcome.added)}`);
      if (outcome.updated.length) parts.push(`topped up ${names2(outcome.updated)}`);
      if (outcome.present.length) parts.push(`${names2(outcome.present)} already in the cart`);
      if (outcome.failed.length) parts.push(`could not add ${names2(outcome.failed)}`);
      t.status = "Cart: " + parts.join("; ") + ".";
    } catch (error) {
      t.status = error.message;
    }
    scheduleScan3();
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
  function makeDraggable(button) {
    let start = null;
    let moved = false;
    const place2 = (x, y) => {
      button.style.left = `${Math.min(Math.max(4, x), innerWidth - button.offsetWidth - 4)}px`;
      button.style.top = `${Math.min(Math.max(4, y), innerHeight - button.offsetHeight - 4)}px`;
      button.style.right = "auto";
      button.style.bottom = "auto";
    };
    const placeSaved = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null");
        if (saved) place2(saved.x * innerWidth, saved.y * innerHeight);
      } catch {
      }
    };
    const save2 = () => {
      const box = button.getBoundingClientRect();
      try {
        localStorage.setItem(POSITION_KEY, JSON.stringify({ x: box.left / innerWidth, y: box.top / innerHeight }));
      } catch {
      }
    };
    button.addEventListener("pointerdown", (event) => {
      if (event.button) return;
      const box = button.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
      moved = false;
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener("pointermove", (event) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      place2(start.left + dx, start.top + dy);
    });
    const end = () => {
      if (start && moved) save2();
      start = null;
    };
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener(
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

  // src/ui.js
  var SETTINGS_KEY = "mwia-settings";
  var DEFAULT_SETTINGS = { goldWeight: 0, acceptRareDeaths: false, accuracy: "normal", budget: 2e6, spending: "balanced", maxTier: 1, zone: "auto", skillingSkill: "all", skillingSellAt: "ask", skillingTeas: "current", skillingSellCap: 0, skillingMode: "away", skillingGold: 100 };
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
    marketWatch: null
    // timer waiting for the marketplace to close
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
  var int = (n2) => Math.round(n2).toLocaleString("en-US");
  var dec2 = (n2, d = 1) => n2.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  var pct3 = (n2) => (n2 >= 0 ? "+" : "") + dec2(n2 * 100, 1) + "%";
  var HOURS_PER_DAY3 = 24;
  var perDay = (perHour) => perHour * HOURS_PER_DAY3;
  function coins4(n2) {
    if (n2 === null || n2 === void 0) return "\u2013";
    const abs = Math.abs(n2);
    if (abs >= 1e9) return dec2(n2 / 1e9, 2) + "B";
    if (abs >= 1e6) return dec2(n2 / 1e6, abs >= 1e7 ? 1 : 2) + "M";
    if (abs >= 1e4) return dec2(n2 / 1e3, 0) + "k";
    return int(n2);
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
    if (deaths <= deathLimit(ui.settings)) return `<span class="mwia-ok" title="Deaths per hour \u2013 within what you accept">\u2714 ${dec2(deaths, 2)}/h</span>`;
    if (deaths < 1) return `<span class="mwia-warn" title="Deaths per hour">\u26A0 ${dec2(deaths, 2)}/h</span>`;
    return `<span class="mwia-bad" title="Deaths per hour">\u2716 ${dec2(deaths, 1)}/h</span>`;
  }
  var signed = (text, n2) => (n2 >= 0 ? "+" : "\u2212") + text(Math.abs(n2));
  var focusText = (gold) => gold === 0 ? "XP only" : gold === 100 ? "Gold only" : `${100 - gold}% XP \xB7 ${gold}% gold`;
  var XP_LABEL = "Combat XP/h";
  function currentProfile() {
    const data = getClientData();
    if (!state.character || !data) return null;
    return buildProfile(state.character, state.items, data);
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
    render();
    try {
      await ensureReady();
      await task();
    } catch (error) {
      if (error.message !== "Cancelled") {
        console.error("[Combat Advisor]", error);
        ui.error = error.message || String(error);
      }
    } finally {
      ui.busy = false;
      ui.progress = null;
      render();
    }
  }
  function progress(label) {
    return (done2, total) => {
      ui.progress = { done: done2, total, label };
      renderProgress();
    };
  }
  function runSettings() {
    const accuracy = ACCURACY[ui.settings.accuracy] || ACCURACY.normal;
    return { ...accuracy, budget: Number(ui.settings.budget) || 0, maxTier: Number(ui.settings.maxTier) || 0 };
  }
  async function doZones() {
    const profile = currentProfile();
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
  function rerateUpgrades() {
    if (!ui.upgradeRaw) return;
    ui.upgradeResult = rateUpgrades(ui.upgradeRaw, ui.settings);
    ui.plan = buildPlan(ui.upgradeResult, Number(ui.settings.budget) || 0, ui.settings.spending);
    ui.verified = null;
    saveCombatSetup();
  }
  function saveCombatSetup() {
    const raw = ui.upgradeRaw;
    const plan = ui.plan;
    if (!raw || !plan) return;
    const target = applyPlan(raw.baseProfile, { picks: [], drink: plan.drink, food: plan.food });
    const slots = slotCounts(raw.baseProfile, getClientData());
    const perHour = { ...raw.base.consumables, ...plan.drink?.result?.consumables || {}, ...plan.food?.result?.consumables || {}, ...ui.verified?.planned?.consumables || {} };
    rememberCombatSetup(raw.zone, { drinks: target.drinks.slice(0, slots.drinks), food: target.food.slice(0, slots.food), perHour });
  }
  async function doRefine() {
    await refineUncertain(ui.pool, ui.upgradeRaw, ui.settings, progress("Re-running uncertain suggestions"));
    rerateUpgrades();
  }
  async function doUpgrades() {
    const profile = currentProfile();
    if (ui.settings.zone === "auto" && !ui.zoneResults) await doZones();
    const zone = chosenZone(profile);
    if (!zone) throw new Error("Pick a zone first.");
    const settings = runSettings();
    ui.upgradeRaw = await analyzeUpgrades(ui.pool, profile, zone, settings, progress("Testing upgrades"), progress("Re-running uncertain suggestions"));
    rerateUpgrades();
    if (ui.plan.picks.length || ui.plan.drink || ui.plan.food) {
      ui.verified = await verifyPlan(ui.pool, profile, ui.plan, zone, settings, progress("Checking the shopping list"));
      saveCombatSetup();
    }
  }
  function render() {
    if (!ui.root) return;
    const body = ui.root.querySelector(".mwia-body");
    ui.root.querySelectorAll(".mwia-tab").forEach((t3) => t3.classList.toggle("mwia-active", t3.dataset.tab === ui.tab));
    ui.root.querySelector(".mwia-status").innerHTML = statusLine();
    ui.cartItems = /* @__PURE__ */ new Map();
    let html = "";
    if (ui.error) html += `<div class="mwia-error">${esc(ui.error)}</div>`;
    if (ui.notice && (ui.tab === "upgrades" || ui.tab === "skilling")) html += `<div class="mwia-notice mwia-notice-${ui.notice.level}">${esc(ui.notice.text)}</div>`;
    if (ui.busy) html += progressHtml();
    if (ui.tab === "overview") html += renderOverview();
    else if (ui.tab === "zones") html += renderZones();
    else if (ui.tab === "upgrades") html += renderUpgrades();
    else if (ui.tab === "skilling") html += renderSkillingTab();
    else html += renderGuide();
    body.innerHTML = html;
    labelTableCells(body);
  }
  function statusLine() {
    if (!state.character) return '<span class="mwia-warn">Waiting for character data \u2013 reload the page if this stays.</span>';
    const age = pricesAge();
    const prices2 = age === null ? "prices load on first analysis" : `prices ${Math.round(age / 6e4)} min old`;
    return `${esc(state.character.character?.name || "")} \xB7 ${prices2}`;
  }
  function progressHtml() {
    const p = ui.progress || { done: 0, total: 0, label: "" };
    const share = p.total ? 100 * p.done / p.total : 0;
    return `<div class="mwia-progress"><div class="mwia-progress-label"><span>${esc(p.label)} ${p.total ? `${p.done}/${p.total}` : ""}</span>
        <button class="mwia-link" data-action="cancel">Cancel</button></div>
        <div class="mwia-bar"><div style="width:${share}%"></div></div></div>`;
  }
  function renderProgress() {
    const node = ui.root?.querySelector(".mwia-progress");
    if (!node) return render();
    const p = ui.progress;
    node.querySelector(".mwia-progress-label span").textContent = `${p.label} ${p.total ? `${p.done}/${p.total}` : ""}`;
    node.querySelector(".mwia-bar div").style.width = `${p.total ? 100 * p.done / p.total : 0}%`;
  }
  function settingsHtml(fields) {
    const s = ui.settings;
    const parts = [];
    if (fields.includes("focus")) {
      const gold = Math.round((Number(s.goldWeight) || 0) * 100);
      parts.push(`<label class="mwia-focus" title="What to optimise for: XP per hour, gold (loot minus food/drink cost) per hour, or a mix. Changing it re-ranks instantly \u2013 no new simulation needed.">
            Focus: <span class="mwia-focus-text">${focusText(gold)}</span>
            <span class="mwia-focus-row">XP <input type="range" min="0" max="100" step="10" value="${gold}" data-setting="goldWeight"> Gold</span></label>`);
    }
    if (fields.includes("accuracy")) {
      parts.push(`<label>Accuracy <select data-setting="accuracy">${Object.entries(ACCURACY).map(([k, v]) => `<option value="${k}" ${s.accuracy === k ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>`);
    }
    if (fields.includes("risk")) {
      parts.push(`<label title="A death costs 150 s of waiting, which is already counted in XP/h and profit. Allowing rare deaths lets harder, more rewarding zones and upgrades be recommended.">
            Deaths <span class="mwia-focus-row"><input type="checkbox" data-setting="acceptRareDeaths" ${s.acceptRareDeaths ? "checked" : ""}> Accept rare deaths (\u2264 ${dec2(0.5, 1)}/h)</span></label>`);
    }
    if (fields.includes("maxTier")) {
      parts.push(`<label title="Difficulty tier. Higher tiers give more XP but are more dangerous.">Max tier <select data-setting="maxTier">${[0, 1, 2, 3, 4, 5].map((t3) => `<option value="${t3}" ${Number(s.maxTier) === t3 ? "selected" : ""}>T${t3}</option>`).join("")}</select></label>`);
    }
    if (fields.includes("budget")) {
      parts.push(`<label title="E.g. 500k, 2M, 1.5M">Budget (coins) <input data-setting="budget" type="text" inputmode="decimal" size="8" value="${coinsInput(Number(s.budget) || 0)}"></label>`);
    }
    if (fields.includes("spending")) {
      parts.push(`<label title="How much a purchase must give back. Frugal: at least +10% XP/h per 1M coins, Balanced: +3%, All in: anything within budget.">Spending <select data-setting="spending">${Object.entries(SPENDING).map(([k, v]) => `<option value="${k}" ${s.spending === k ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>`);
    }
    if (fields.includes("zone")) {
      const options = ['<option value="auto">Automatic (best safe zone)</option>'];
      for (const zone of getClientData() ? combatZones() : []) {
        for (let t3 = 0; t3 <= Math.min(5, zone.maxDifficulty ?? 0); t3++) {
          const value = `${zone.hrid}#${t3}`;
          options.push(`<option value="${value}" ${s.zone === value ? "selected" : ""}>${esc(zone.name)}${t3 ? " T" + t3 : ""}</option>`);
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
    const levelRows = COMBAT_SKILLS.map((s) => `<tr><td>${SKILL_NAMES[s]}</td><td class="mwia-num">${levels[s]}</td></tr>`).join("");
    const gearRows = Object.keys(SLOT_NAMES).filter((t3) => t3 !== "two_hand" || profile.equipment.two_hand).filter((t3) => t3 !== "main_hand" || !profile.equipment.two_hand).map((t3) => `<tr><td>${SLOT_NAMES[t3]}</td><td>${gearLabel(profile.equipment[t3])}</td></tr>`).join("");
    const abilityRows = [];
    for (let i = 1; i <= Math.max(slots.abilities, 1); i++) {
      const a = profile.abilities[i];
      abilityRows.push(
        `<li>${i <= slots.abilities ? a ? `${esc(abilityName(a.hrid))} <span class="mwia-dim">lvl ${a.level}</span>` : '<span class="mwia-warn">empty slot</span>' : '<span class="mwia-dim">locked</span>'}</li>`
      );
    }
    const consumableList = (list, count2) => Array.from({ length: count2 }, (_, i) => `<li>${list[i] ? esc(itemName(list[i])) : '<span class="mwia-warn">empty slot</span>'}</li>`).join("");
    return `
    <div class="mwia-grid">
      <section><h3>Levels</h3>
        <table class="mwia-table">${levelRows}
        <tr class="mwia-sum"><td>Combat level</td><td class="mwia-num">${dec2(combatLevel(levels), 1)}</td></tr></table></section>
      <section><h3>Equipment</h3><table class="mwia-table">${gearRows}</table></section>
      <section><h3>Abilities (${slots.abilities} slot${slots.abilities === 1 ? "" : "s"})</h3><ol>${abilityRows.join("")}</ol>
        <h3>Food (${slots.food})</h3><ul>${consumableList(profile.food, slots.food)}</ul>
        <h3>Drinks (${slots.drinks})</h3><ul>${consumableList(profile.drinks, slots.drinks)}</ul></section>
    </div>
    <h3>Tips for your character</h3>
    <ul class="mwia-tips">${tips.map((t3) => `<li class="mwia-tip-${t3.level}">${t3.html}</li>`).join("")}</ul>
    <p class="mwia-dim">Next step: the <b>Where to fight</b> tab, then <b>Upgrades</b>.</p>`;
  }
  function overviewTips(profile, slots, data) {
    const tips = [];
    const weapon = profile.equipment.main_hand || profile.equipment.two_hand;
    const weaponStats = weapon ? data.itemDetailMap[weapon.hrid]?.equipmentDetail?.combatStats : null;
    if (!weapon) {
      tips.push({ level: "bad", html: "You have no weapon. A mage needs a <b>staff</b> (e.g. Wooden/Birch/Cedar Water/Nature/Fire Staff)." });
    } else if (!(weaponStats?.combatStyleHrids || []).includes("/combat_styles/magic")) {
      tips.push({ level: "bad", html: `${esc(itemName(weapon.hrid))} is not a magic weapon, so you don't train Magic. Switch to a staff.` });
    }
    const emptyAbilities = [];
    for (let i = 1; i <= slots.abilities; i++) if (!profile.abilities[i]) emptyAbilities.push(i);
    if (emptyAbilities.length) {
      tips.push({ level: "bad", html: `You have ${emptyAbilities.length} empty ability slot(s). Abilities are a mage's main source of damage \u2013 see <b>Upgrades</b> for which one pays off.` });
    }
    const requirements = data.abilitySlotsLevelRequirementList || [];
    const nextSlotLevel = requirements.slice(2).find((lvl) => lvl > profile.levels.intelligence);
    if (nextSlotLevel && nextSlotLevel - profile.levels.intelligence <= 8) {
      tips.push({ level: "info", html: `At Intelligence ${nextSlotLevel} you unlock another ability slot (you're at ${profile.levels.intelligence}).` });
    }
    if (!profile.food.slice(0, slots.food).some(Boolean)) {
      tips.push({ level: "bad", html: "You have no food for combat. Food is eaten automatically when you lose HP and keeps you from dying." });
    }
    if (profile.drinks.slice(0, slots.drinks).some((d) => !d)) {
      tips.push({ level: "warn", html: "You have an empty drink slot. Coffee gives a 5-minute buff \u2013 <b>Upgrades</b> shows whether it pays off for you." });
    }
    const badArmor = Object.entries(profile.equipment).filter(([type]) => !["main_hand", "two_hand"].includes(type)).filter(([, gear]) => (data.itemDetailMap[gear.hrid]?.equipmentDetail?.combatStats?.magicAccuracy || 0) < 0).map(([, gear]) => itemName(gear.hrid));
    if (badArmor.length) {
      tips.push({ level: "warn", html: `${badArmor.map(esc).join(", ")} lower(s) your magic accuracy. Mage clothing (cotton/linen/\u2026) is usually better \u2013 check <b>Upgrades</b>.` });
    }
    if (!profile.equipment.charm) {
      tips.push({ level: "info", html: "No charm. A <b>Magic Charm</b> sends 70% of your combat XP to Magic (otherwise it's split across five skills) \u2013 wear one if Magic is your priority." });
    }
    if (!tips.length) tips.push({ level: "ok", html: "No obvious gaps. Run the zone and upgrade analyses to fine-tune." });
    return tips;
  }
  var CAPPED_TITLE = "You kill faster than new monsters appear (one encounter per 3 s at most), so more damage barely helps here";
  var cappedBadge = (r) => isSpawnCapped(r) ? ` <span class="mwia-warn" title="${CAPPED_TITLE}">\u23F1</span>` : "";
  function renderZones() {
    let html = `<p>Simulates your current setup against every combat zone and shows where you get the most XP or gold per hour
      <b>${ui.settings.acceptRareDeaths ? "while dying rarely at most" : "without dying"}</b>.</p>
      ${settingsHtml(["focus", "risk", "accuracy", "maxTier"])}
      <button class="mwia-btn" data-action="zones" ${ui.busy ? "disabled" : ""}>Run zone analysis</button>`;
    if (!ui.zoneResults) return html;
    const goal = zoneGoal(ui.zoneResults, ui.settings);
    const best = pickBestZone(ui.zoneResults, ui.settings);
    const profile = currentProfile();
    const current = profile?.currentZone && ui.zoneResults.find((z) => z.zone.zoneHrid === profile.currentZone.zoneHrid && z.zone.tier === profile.currentZone.tier);
    const summary = (r) => `<b>${int(xpValue(r))} ${XP_LABEL}</b> and <b>${coins4(perDay(r.profit))}</b> profit/day`;
    if (best) {
      html += `<div class="mwia-reco"><b>Recommendation:</b> ${zoneLabel(best.zone)} \u2013 about ${summary(best.result)}, ${deathBadge(best.result.deaths)}.`;
      if (isSpawnCapped(best.result)) {
        html += `<br>\u23F1 You kill monsters here as fast as they appear, so this zone is too easy for you.
              ${Number(ui.settings.maxTier) < 5 ? "Raise <b>Max tier</b> and run again \u2013 a harder tier gives more XP per kill." : "Try zones with tougher monsters."}`;
      }
      if (current && current !== best) html += `<br>You're currently fighting in ${zoneLabel(current.zone)}: ${summary(current.result)}.`;
      html += `</div>`;
    }
    const bestScore = best ? score(best.result, goal) : 1;
    const rows = [...ui.zoneResults].sort((a, b) => score(b.result, goal) - score(a.result, goal));
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>Zone</th><th class="mwia-num" title="How well the zone fits your focus; 100 = the recommended zone">Match</th>
      <th class="mwia-num">${XP_LABEL}</th><th class="mwia-num" title="Value of drops (bid price) minus food/drink cost, per day">Profit/day</th>
      <th class="mwia-num">Kills/h</th><th>Risk</th></tr></thead><tbody>`;
    for (const z of rows.slice(0, 40)) {
      const r = z.result;
      const match = bestScore > 0 ? int(100 * score(r, goal) / bestScore) : "\u2013";
      html += `<tr class="${z === best ? "mwia-best" : ""}"><td>${zoneLabel(z.zone)}${cappedBadge(r)}</td><td class="mwia-num">${match}</td><td class="mwia-num">${int(xpValue(r))}</td>
          <td class="mwia-num">${coins4(perDay(r.profit))}</td><td class="mwia-num">${dec2(r.killsTotal, 0)}</td><td>${deathBadge(r.deaths)}</td></tr>`;
    }
    html += `</tbody></table><p class="mwia-dim">Simulated ${int(Math.max(1, runSettings().hours / 2))} h per zone. These are estimates \u2013 differences of a few percent are noise.
      \u23F1 = you kill faster than monsters appear there.</p>`;
    return html;
  }
  function upgradeNotes(c2, base) {
    const notes = [];
    if (c2.owned && c2.cost === 0) notes.push('<span class="mwia-ok">you own it</span>');
    if (c2.deathsDelta < 0 && base.deaths > 0) notes.push(`<span class="mwia-ok">fewer deaths</span>`);
    if (!c2.safe) notes.push(`<span class="mwia-bad">more deaths</span>`);
    return notes.join(" ");
  }
  function cartItems(c2) {
    const forOneDay = (hrid) => Math.max(1, Math.ceil(perDay(c2.result?.consumables?.[hrid] || 0)));
    if (c2.kind === "abilityLevel") return [{ hrid: c2.bookHrid, quantity: c2.books }];
    if (c2.kind === "ability") return c2.cost ? [{ hrid: c2.bookHrid, quantity: 1 }] : [];
    if (c2.kind === "food" || c2.kind === "drinks") return c2.remove ? [] : [{ hrid: c2.hrid, quantity: forOneDay(c2.hrid) }];
    const items = c2.cost ? [{ hrid: c2.hrid, quantity: 1, enhancementLevel: c2.enhancementLevel || 0 }] : [];
    if (c2.extraFood) items.push({ hrid: c2.extraFood, quantity: forOneDay(c2.extraFood) });
    return items;
  }
  var cartLabel = (i) => `${i.quantity ? i.quantity + "\xD7 " : ""}${itemName(i.hrid)}${i.enhancementLevel ? " +" + i.enhancementLevel : ""}`;
  function cartButton3(items, label = "\u{1F6D2} Add") {
    if (!items.length) return "";
    const id = String(ui.cartItems.size + 1);
    ui.cartItems.set(id, items);
    return `<button class="mwia-cart-btn" data-action="cart-add" data-cart="${id}" title="Add to the MWITools shopping cart: ${esc(items.map(cartLabel).join(", "))}">${label}</button>`;
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
    render();
  }
  function renderUpgrades() {
    let html = `<p>Tests one change at a time (gear incl. enhanced +N copies, new abilities, levelling abilities with extra books, drinks, food) in the chosen zone
      and measures how much it improves your focus \u2013 XP per hour, gold per hour, or a mix. Buy the things that give the most per coin first.</p>
      ${settingsHtml(["focus", "zone", "budget", "spending", "risk", "accuracy"])}
      <button class="mwia-btn" data-action="upgrades" ${ui.busy ? "disabled" : ""}>Analyze upgrades</button>`;
    const result = ui.upgradeResult;
    if (!result) return html;
    const base = result.base;
    const label = XP_LABEL;
    html += `<p>Zone: ${zoneLabel(result.zone)}. Now: <b>${int(xpValue(base))} ${label}</b>, profit <b>${coins4(perDay(base.profit))}/day</b>
      (loot ${coins4(perDay(base.loot))} \u2212 food/drinks ${coins4(perDay(base.cost))}), ${deathBadge(base.deaths)}.</p>`;
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
    if (!plan || !plan.picks.length && !plan.drink && !plan.food) {
      html += `<p>Nothing within budget gave a reliable improvement that is worth its price. Try Spending "All in", raise the budget, try another zone,
          or just keep levelling \u2013 at some levels that really is the best move.</p>`;
    } else {
      html += `<ol class="mwia-plan">`;
      for (const p of plan.picks) {
        let what;
        if (p.kind === "abilityLevel") {
          what = `${p.books}\xD7 <b>${esc(itemName(p.bookHrid))}</b> and read them: ${esc(abilityName(p.hrid))} level ${p.fromLevel} \u2192 ${p.level}`;
        } else if (p.kind === "ability") {
          what = `ability <b>${esc(abilityName(p.hrid))}</b>${p.cost ? ` (buy the book ${esc(itemName(p.bookHrid))})` : ` (level ${p.level})`}`;
        } else {
          what = `<b>${gearLabel(p)}</b> in ${SLOT_NAMES[p.slot]}${p.extraFood ? ` and put <b>${esc(itemName(p.extraFood))}</b> in the new food slot` : ""}`;
        }
        const replaces = p.replaces ? ` \u2013 replaces ${p.kind === "ability" ? esc(abilityName(p.replaces)) : gearLabel(p.replaces)}` : "";
        html += `<li>${p.cost ? "Buy" : "Use"} ${what}${replaces}: ${gainText(p)} ${p.cost ? `for ${coins4(p.cost)}` : "(free)"} ${cartButton3(cartItems(p))}</li>`;
      }
      for (const [kind, pick, max] of [["Food", plan.food, plan.foodMax], ["Drink", plan.drink, plan.drinkMax]]) {
        if (!pick) continue;
        if (pick.remove) {
          html += `<li>Stop using <b>${esc(itemName(pick.hrid))}</b> (empty that ${kind.toLowerCase()} slot): ${gainText(pick)},
                  saves about ${coins4(perDay(-pick.costPerHourDelta))}/day`;
        } else {
          const where = pick.replaces ? `instead of ${esc(itemName(pick.replaces))}` : "in an empty slot";
          const money = pick.costPerHourDelta < 0 ? `saves about ${coins4(perDay(-pick.costPerHourDelta))}/day` : `costs about ${coins4(perDay(pick.costPerHourDelta))}/day extra`;
          html += `<li>${kind} <b>${esc(itemName(pick.hrid))}</b> ${where}: ${gainText(pick)}, ${money}
                  <span class="mwia-dim">(optional \u2013 a running cost)</span> ${cartButton3(cartItems(pick), "\u{1F6D2} 1 day")}`;
        }
        if (dropsHpFood(pick)) {
          html += `<br><span class="mwia-warn">You don't need HP food in this zone, but keep some at hand \u2013 put it back before you move to a harder zone or tier.</span>`;
        }
        if (max) html += `<br><span class="mwia-dim">Biggest gain: ${esc(itemName(max.hrid))} (${gainText(max)}) at ${coins4(perDay(max.costPerHourDelta))}/day.</span>`;
        html += `</li>`;
      }
      html += `</ol><p>Total one-time cost: <b>${coins4(plan.spent)}</b> of your ${coins4(Number(ui.settings.budget) || 0)} budget.
          ${cartButton3(plan.picks.flatMap(cartItems), "\u{1F6D2} Add all purchases to cart")}</p>`;
      if (ui.verified) {
        const v = ui.verified;
        const before = xpValue(v.base);
        const after = xpValue(v.planned);
        html += `<div class="mwia-reco">Everything combined (simulated): <b>${int(before)} \u2192 ${int(after)} ${label}</b> (${pct3(after / Math.max(1, before) - 1)}),
              profit <b>${coins4(perDay(v.base.profit))} \u2192 ${coins4(perDay(v.planned.profit))}</b> per day (food/drinks ${coins4(perDay(v.base.cost))} \u2192 ${coins4(perDay(v.planned.cost))}),
              deaths ${dec2(v.base.deaths, 2)} \u2192 ${dec2(v.planned.deaths, 2)} per hour.
              <br><span class="mwia-dim">Run the zone analysis again after buying \u2013 with better gear a harder zone may become the best.</span></div>`;
      }
    }
    html += upgradeTable("Equipment", result.gear, base, (c2) => SLOT_NAMES[c2.slot], (c2) => gearLabel(c2) + (c2.extraFood ? ` <span class="mwia-dim">+ ${esc(itemName(c2.extraFood))} in new slot</span>` : ""), (c2) => c2.replaces ? gearLabel(c2.replaces) : "\u2013", "Item");
    html += upgradeTable(
      "Abilities",
      result.abilities,
      base,
      (c2) => `Slot ${c2.slot.replace("ability", "")}`,
      (c2) => esc(abilityName(c2.hrid)) + (c2.kind === "abilityLevel" ? ` <span class="mwia-dim">lvl ${c2.fromLevel} \u2192 ${c2.level} (${c2.books} books)</span>` : ` <span class="mwia-dim">lvl ${c2.level}</span>`),
      (c2) => c2.kind === "abilityLevel" ? '<span class="mwia-dim">level up</span>' : c2.replaces ? esc(abilityName(c2.replaces)) : "\u2013",
      "Ability"
    );
    if (!getClientData().levelExperienceTable) {
      html += `<p class="mwia-dim">The game data has no level table, so levelling up abilities with extra books could not be evaluated.</p>`;
    }
    html += consumableTable("Drinks", result.drinks, base);
    html += consumableTable("Food", result.food, base);
    if (result.food.some((c2) => !c2.safe && c2.delta > 0) && result.gear.some((c2) => c2.extraFood && c2.safe && c2.delta > 0)) {
      html += `<p class="mwia-reco">Some food gives more XP but makes you die, because it replaces your only HP food. A bigger pouch gives an extra
          food slot so you can keep both \u2013 see the pouch row under Equipment.</p>`;
    }
    html += `<p class="mwia-dim">Prices = lowest sell order on the market right now, also for enhanced (+N) gear. "Gain" = improvement of your focus as a share of
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
    return before.some((h2) => h2 && heals(h2)) && !after.some((h2) => h2 && heals(h2));
  }
  function gainText(c2) {
    const gold = ui.upgradeResult.goal.gold;
    const profit = `${signed(coins4, perDay(c2.profitDelta))} profit/day`;
    if (gold === 0) return `${pct3(c2.deltaPct)} ${XP_LABEL}`;
    if (gold === 1) return profit;
    return `${pct3(c2.deltaPct)} gain (${signed(int, c2.xpDelta)} ${XP_LABEL}, ${profit})`;
  }
  function confidenceCell(c2) {
    const value = Math.round(c2.confidence * 100);
    const cls = c2.confidence >= CONFIDENCE_LEVEL ? "mwia-ok" : c2.confidence >= 0.7 ? "mwia-warn" : "mwia-dim";
    return `<span class="${cls}" title="Chance that this really improves your focus, from ${c2.runs.length} paired simulations">${value}%</span>`;
  }
  var CONF_TITLE = "How sure we are that this is an improvement and not luck (paired t-test over several simulations with different random seeds). Only \u2265 90% goes on the shopping list.";
  var GAIN_TITLE = "Improvement of your focus as a share of what you have now: XP/h and profit/h, weighted by the XP\u2013Gold slider";
  function upgradeTable(title, list, base, slotText, nameHtml, replacesHtml, nameHeader) {
    const shown = list.filter((c2) => c2.delta > 0).slice(0, 20);
    let html = `<h3>${title}</h3>`;
    if (!shown.length) return html + `<p class="mwia-dim">Nothing within budget improved your focus.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>Slot</th><th>${nameHeader}</th><th>Replaces</th><th class="mwia-num">Price</th>
      <th class="mwia-num">+${XP_LABEL}</th><th class="mwia-num">+Profit/day</th><th class="mwia-num" title="${GAIN_TITLE}">Gain</th>
      <th class="mwia-num">Gain per 1M</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th></th><th></th></tr></thead><tbody>`;
    for (const c2 of shown) {
      const efficiency = c2.cost > 0 ? pct3(c2.delta / c2.cost * 1e6) : "\u221E";
      html += `<tr class="${c2.significant ? "" : "mwia-faded"}"><td>${slotText(c2)}</td><td>${nameHtml(c2)}</td><td>${replacesHtml(c2)}</td>
          <td class="mwia-num">${c2.cost ? coins4(c2.cost) : "0"}</td><td class="mwia-num">${signed(int, c2.xpDelta)}</td><td class="mwia-num">${signed(coins4, perDay(c2.profitDelta))}</td>
          <td class="mwia-num">${pct3(c2.deltaPct)}</td><td class="mwia-num">${efficiency}</td><td class="mwia-num">${confidenceCell(c2)}</td>
          <td>${upgradeNotes(c2, base)}</td><td>${cartButton3(cartItems(c2))}</td></tr>`;
    }
    return html + `</tbody></table>`;
  }
  function consumableTable(title, list, base) {
    const shown = list.filter((c2) => c2.delta > 0 || c2.deathsDelta < 0).slice(0, 10);
    let html = `<h3>${title}</h3>`;
    if (!shown.length) return html + `<p class="mwia-dim">No ${title.toLowerCase()} noticeably improved your focus.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>${title === "Food" ? "Food" : "Drink"}</th><th>Replaces</th><th class="mwia-num">Unit price</th>
      <th class="mwia-num">Extra cost/day</th><th class="mwia-num">+${XP_LABEL}</th><th class="mwia-num" title="Includes the extra food/drink cost">+Profit/day</th>
      <th class="mwia-num" title="${GAIN_TITLE}">Gain</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th class="mwia-num">Deaths/h</th><th class="mwia-num" title="Extra cost per 1000 extra XP">Cost per 1000 XP</th><th></th></tr></thead><tbody>`;
    for (const c2 of shown) {
      const per1000 = c2.xpDelta > 0 ? coins4(c2.costPerHourDelta / c2.xpDelta * 1e3) : c2.remove && c2.xpDelta < 0 ? `saves ${coins4(c2.costPerHourDelta / c2.xpDelta * 1e3)}` : "\u2013";
      const name = (c2.remove ? `<i>Stop using</i> ${esc(itemName(c2.hrid))}` : esc(itemName(c2.hrid))) + (dropsHpFood(c2) ? ' <span class="mwia-warn" title="Leaves you without HP food \u2013 fine in this zone, risky in harder ones">\u26A0 no HP food</span>' : "");
      html += `<tr class="${c2.significant ? "" : "mwia-faded"}"><td>${name}</td><td>${c2.replaces ? esc(itemName(c2.replaces)) : "\u2013"}</td>
          <td class="mwia-num">${c2.remove ? "\u2013" : coins4(askPrice(c2.hrid))}</td><td class="mwia-num">${coins4(perDay(c2.costPerHourDelta))}</td><td class="mwia-num">${signed(int, c2.xpDelta)}</td>
          <td class="mwia-num">${signed(coins4, perDay(c2.profitDelta))}</td><td class="mwia-num">${pct3(c2.deltaPct)}</td><td class="mwia-num">${confidenceCell(c2)}</td>
          <td class="mwia-num ${c2.safe ? "" : "mwia-bad"}">${dec2(c2.result.deaths, 2)}${c2.safe ? "" : " \u2716"}</td><td class="mwia-num">${per1000}</td>
          <td>${cartButton3(cartItems(c2), "\u{1F6D2} 1 day")}</td></tr>`;
    }
    return html + `</tbody></table>`;
  }
  function renderGuide() {
    return `<div class="mwia-guide">
    <h3>How combat XP works</h3>
    <p>Every kill gives XP. As a mage, <b>30%</b> goes to Magic and the remaining <b>70%</b> is split evenly between Stamina, Intelligence,
    Attack, Defense and Magic \u2013 so Magic gets 44% in total. With a <b>charm</b> that has a focus (e.g. Trainee Magic Charm) the whole 70% share
    goes to that skill instead. More damage and fewer deaths mean more kills per hour, and therefore more XP.</p>
    <h3>What the skills do</h3>
    <ul>
      <li><b>Magic</b> \u2013 raises your magic max damage (both auto-attacks and abilities).</li>
      <li><b>Attack</b> \u2013 accuracy. Misses deal no damage at all.</li>
      <li><b>Intelligence</b> \u2013 max mana (10 \xD7 (10 + level)) and more ability slots (at levels 20, 50 and 90).</li>
      <li><b>Stamina</b> \u2013 max HP (10 \xD7 (10 + level)).</li>
      <li><b>Defense</b> \u2013 evasion against enemy attacks.</li>
    </ul>
    <h3>Abilities</h3>
    <p>A mage's auto-attack is weak \u2013 staves halve auto-attack damage. Most of your damage comes from <b>abilities</b> (e.g. Water Strike, Fireball,
    Entangle). They cost mana, are learned by reading an ability book (bought on the market) and get stronger as they level up, which happens
    when you use them or read more copies of the same book. Order matters: the topmost ability that can be cast goes first.</p>
    <h3>Food and drinks</h3>
    <p><b>Food</b> is eaten automatically according to its triggers (by default when you're missing enough HP/MP). HP food keeps you alive,
    MP food lets you keep casting abilities. <b>Drinks</b> (coffee) give a 5-minute buff, e.g. Magic Coffee (+Magic level)
    or Wisdom Coffee (+XP). A <b>pouch</b> gives extra food and drink slots.</p>
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
    const load = ui.skillingLoad;
    if (load?.error) {
      return `<div class="mwia-error">${esc(load.error)}</div><button class="mwia-btn" data-action="skilling-load">Try again</button>`;
    }
    if (!load?.loading) {
      ui.skillingLoad = { loading: true };
      Promise.all([loadClientData(ui.win), loadPrices()]).then(() => ui.skillingLoad = null).catch((error) => ui.skillingLoad = { error: error.message || String(error) }).finally(() => ui.tab === "skilling" && render());
    }
    return `<p class="mwia-dim">Loading game data and market prices\u2026</p>`;
  }
  function returnAfterMarket() {
    clearInterval(ui.marketWatch);
    const started = Date.now();
    let seen = false;
    ui.marketWatch = setInterval(() => {
      if (!ui.root.classList.contains("mwia-hidden")) return clearInterval(ui.marketWatch);
      const open = [...document.querySelectorAll(MARKET_PANEL)].some(visible);
      if (open) seen = true;
      else if (seen) {
        clearInterval(ui.marketWatch);
        showPanel();
      } else if (Date.now() - started > MARKET_SHOW_MS) clearInterval(ui.marketWatch);
    }, MARKET_POLL_MS);
  }
  function showPanel() {
    ui.root.classList.remove("mwia-hidden");
    render();
    const row = ui.returnRow && ui.tab === "skilling" ? [...ui.root.querySelectorAll(".mwia-skill-row")].find((r) => r.dataset.hrid === ui.returnRow) : null;
    row?.scrollIntoView({ block: "start" });
    ui.returnRow = null;
  }
  async function openWithCount(actionHrid, count2) {
    const data = getClientData();
    const action = data?.actionDetailMap[actionHrid];
    if (!action || !count2) return;
    ui.root.classList.add("mwia-hidden");
    if (await openAction(ui.win, action, data)) {
      const found = findActionPanel(action.name);
      if (found?.input) setReactInput(found.input, count2);
      return;
    }
    ui.root.classList.remove("mwia-hidden");
    ui.notice = { level: "warn", text: `Could not open ${action.name} automatically. Open it yourself and enter ${count2}. (${navDiagnostics()})` };
    render();
  }
  function onClick4(event) {
    const target = event.target.closest("[data-action],[data-tab]");
    if (!target || !ui.root.contains(target)) return;
    if (target.dataset.tab) {
      ui.tab = target.dataset.tab;
      render();
      return;
    }
    switch (target.dataset.action) {
      case "close":
        ui.root.classList.add("mwia-hidden");
        break;
      case "zones":
        runTask(doZones);
        break;
      case "upgrades":
        runTask(doUpgrades);
        break;
      case "refine":
        runTask(doRefine);
        break;
      case "load":
        runTask(async () => {
        });
        break;
      case "skilling-load":
        ui.skillingLoad = null;
        render();
        break;
      case "skilling-make":
        ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
        openWithCount(target.dataset.hrid, Number(target.dataset.count));
        break;
      case "skilling-cart":
        sendItemsToCart(JSON.parse(target.dataset.teas || "[]"));
        break;
      case "skilling-market":
        ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
        if (openMarketplace(ui.win, target.dataset.item)) {
          ui.root.classList.add("mwia-hidden");
          returnAfterMarket();
        } else {
          ui.notice = { level: "warn", text: "Could not open the marketplace automatically. Open it yourself and pick the item." };
          render();
        }
        break;
      case "skilling-all":
        toggleShowAll();
        render();
        break;
      case "cart-add":
        sendToCart(target.dataset.cart);
        break;
      case "cancel":
        ui.pool?.cancel();
        break;
    }
  }
  function onChange(event) {
    const key = event.target.dataset?.setting;
    if (!key) return;
    if (key === "skillingSellCap") {
      const text = event.target.value.trim();
      const value = text === "" ? 0 : parseCoins(text);
      event.target.classList.toggle("mwia-invalid", value === null);
      if (value === null) return;
      ui.settings.skillingSellCap = value;
    } else if (key === "budget") {
      const value = parseCoins(event.target.value);
      event.target.classList.toggle("mwia-invalid", value === null);
      if (value === null) return;
      ui.settings.budget = value;
      event.target.value = coinsInput(value);
    } else if (key === "acceptRareDeaths") {
      ui.settings.acceptRareDeaths = event.target.checked;
    } else if (key === "goldWeight") {
      ui.settings.goldWeight = Number(event.target.value) / 100;
    } else {
      ui.settings[key] = event.target.value;
    }
    saveSettings();
    if (key.startsWith("skilling")) {
      render();
      return;
    }
    if (["budget", "spending", "goldWeight", "acceptRareDeaths"].includes(key) && !ui.busy) {
      if (["goldWeight", "acceptRareDeaths"].includes(key)) rerateUpgrades();
      else if (ui.upgradeResult) {
        ui.plan = buildPlan(ui.upgradeResult, Number(ui.settings.budget) || 0, ui.settings.spending);
        ui.verified = null;
      }
      render();
    }
  }
  function mountUI(win2, workerSource) {
    ui.win = win2;
    ui.workerSource = workerSource;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    const button = document.createElement("button");
    button.className = "mwia-launcher";
    button.title = "Combat Advisor";
    button.textContent = "\u2694 Advisor";
    document.body.appendChild(button);
    makeDraggable(button);
    const root = document.createElement("div");
    root.className = "mwia-panel mwia-hidden";
    root.innerHTML = `
      <div class="mwia-header">
        <div><b>\u2694 Combat Advisor</b> <span class="mwia-status mwia-dim"></span></div>
        <button class="mwia-link" data-action="close" title="Close">\u2715</button>
      </div>
      <nav class="mwia-tabs">
        <button class="mwia-tab" data-tab="overview">Overview</button>
        <button class="mwia-tab" data-tab="zones">Where to fight</button>
        <button class="mwia-tab" data-tab="upgrades">Upgrades</button>
        <button class="mwia-tab" data-tab="skilling">Skilling</button>
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
    startToolNotice(gameDeps);
    ui.root = root;
    root.addEventListener("click", onClick4);
    root.addEventListener("change", onChange);
    root.addEventListener("toggle", rememberToggle, true);
    enableTapTips(root);
    root.addEventListener("input", (event) => {
      if (!["goldWeight", "skillingGold"].includes(event.target.dataset?.setting)) return;
      const label = event.target.closest(".mwia-focus")?.querySelector(".mwia-focus-text");
      if (label) label.textContent = focusText(Number(event.target.value));
    });
    button.addEventListener("click", async () => {
      const opening = root.classList.contains("mwia-hidden");
      if (!opening) {
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
      if (!root.classList.contains("mwia-hidden") && !ui.busy && ui.tab === "skilling") render();
    });
    onStateChange(() => {
      if (!root.classList.contains("mwia-hidden") && !ui.busy) {
        root.querySelector(".mwia-status").innerHTML = statusLine();
      }
    });
  }

  // src/plan-train.js
  var INVENTORY5 = "/item_locations/inventory";
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
      const summary = row.querySelector(":scope > summary") || row;
      const hrid = itemFromIcon(summary.querySelector(".planning-row-icon")) || byName.get(summary.querySelector(".planning-step-name")?.textContent.trim());
      const policy = activePolicy(summary);
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
      if (item.itemLocationHrid !== INVENTORY5 || (item.enhancementLevel || 0) !== 0) continue;
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
        const p = drop.dropRate ?? 1;
        const low = drop.minCount ?? 1;
        const high = drop.maxCount ?? low;
        const spread = (high + low) / 2;
        const mean = p * spread;
        const variance = p * (((high - low + 1) ** 2 - 1) / 12 + spread ** 2) - mean ** 2;
        const best = byItem.get(drop.itemHrid);
        if (mean > 0 && (!best || mean > best.mean)) byItem.set(drop.itemHrid, { action, mean, variance });
      }
    }
    gatherCache.set(data, byItem);
    return byItem;
  }
  var SAFETY_Z = 1.28;
  function gatherCount(need, { mean, variance }) {
    let count2 = Math.max(1, Math.ceil(need / mean - 1e-9));
    while (count2 * mean - SAFETY_Z * Math.sqrt(count2 * variance) < need - 1e-9) count2++;
    return count2;
  }
  function inputsOf(action) {
    const inputs = (action.inputItems || []).map((input) => ({ hrid: input.itemHrid, count: input.count }));
    if (action.upgradeItemHrid) inputs.push({ hrid: action.upgradeItemHrid, count: 1 });
    return inputs;
  }
  function goalDemand(goals, data, houseLevels) {
    const name = (hrid) => data.itemDetailMap[hrid]?.name || hrid.split("/").pop();
    const demand = /* @__PURE__ */ new Map();
    const add = (hrid, count2) => demand.set(hrid, (demand.get(hrid) || 0) + count2);
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
    const add = (hrid, count2) => demand.set(hrid, (demand.get(hrid) || 0) + count2);
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
      const have3 = owned.get(hrid) || 0;
      const need = Math.max(0, wanted - have3);
      const row = { hrid, name: name(hrid), wanted, have: have3, need };
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
      const count2 = gatherCount(shortage.need, { mean, variance });
      return {
        itemHrid: shortage.itemHrid,
        name: shortage.name,
        actionHrid: action.hrid,
        actionName: action.name,
        skill: action.type.split("/").pop(),
        category: action.category,
        count: count2,
        output: Math.round(count2 * mean),
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
  var COIN = "/items/coin";
  function boughtCost(rows, price) {
    let coins5 = 0;
    const unpriced = [];
    for (const row of rows.values()) {
      if (row.action || row.need <= 0 || row.hrid === COIN) continue;
      const each = price(row.hrid);
      if (each === null || each === void 0) unpriced.push(row.name);
      else coins5 += Math.ceil(row.need - 1e-9) * each;
    }
    return { coins: coins5, unpriced };
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
  function itemCosts(hrid, count2, data, { owned, price }) {
    const actions = productionActions(data);
    const name = (h2) => data.itemDetailMap[h2]?.name || h2.split("/").pop();
    const run = (produced) => boughtCost(resolve(/* @__PURE__ */ new Map([[hrid, count2]]), produced, actions, owned, name).rows, price);
    const craftable = actions.has(hrid);
    return {
      buy: run(() => false),
      single: craftable ? run((h2) => h2 === hrid) : null,
      chain: craftable ? run((h2) => actions.has(h2)) : null
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
  function shownRequired(summary) {
    const text = summary.querySelector(".planning-step-count")?.textContent || summary.textContent;
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
    const signature = JSON.stringify([plan.goals, [...plan.policies], pricesAge() !== null && Date.now() - pricesAge()]);
    const fresh = signature === c.signature && Date.now() - c.at < RECOMPUTE_MS;
    const missing = [...steps].some((step) => !step.querySelector(".mwia-plan-cost")) || document.querySelector(".planning-calculate-bar") && !document.querySelector(".mwia-plan-costs");
    if (fresh && !missing) return;
    c.signature = signature;
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
      const summary = step.querySelector(":scope > summary") || step;
      const use = summary.querySelector(".planning-row-icon use");
      const bare = (use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").split("#")[1];
      const hrid = bare ? "/items/" + bare : byName.get(summary.querySelector(".planning-step-name")?.textContent.trim());
      const count2 = wanted.get(hrid) || shownRequired(summary);
      let html = "";
      if (c.priceError || !hrid || !data.itemDetailMap[hrid]) html = "";
      else if (!count2) html = '<span class="mwia-dim">Not needed with the current choices</span>';
      else {
        const costs = itemCosts(hrid, count2, data, { owned, price });
        html = costLine([
          { label: "Buy", cost: costs.buy },
          { label: "One step", cost: costs.single },
          { label: "Full chain", cost: costs.chain }
        ]);
      }
      place(html, summary.querySelector(".mwia-plan-cost"), () => {
        const element = costElement("mwia-plan-cost", ROW_TIP);
        const policySwitch = summary.querySelector(".planning-policy-switch");
        if (policySwitch) policySwitch.after(element);
        else summary.appendChild(element);
        return element;
      });
    }
  }

  // src/train-ui.js
  var STORE_PREFIX = "mwia-train:";
  var LOW_KEY = "mwia-train-low";
  var NOT_QUEUED_AFTER_MS = 4e3;
  var t2 = {
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
  var n = (value) => Math.ceil(value).toLocaleString("en-US");
  var characterId = () => state.character?.character?.id ?? null;
  var storeKey = () => STORE_PREFIX + (characterId() ?? "unknown");
  function save() {
    try {
      if (t2.train) localStorage.setItem(storeKey(), JSON.stringify(t2.train));
      else localStorage.removeItem(storeKey());
    } catch {
    }
  }
  function restore() {
    try {
      t2.train = JSON.parse(localStorage.getItem(storeKey()) || "null");
    } catch {
      t2.train = null;
    }
  }
  function rememberQueuedActions() {
    for (const action of state.character?.characterActions || []) {
      if (action.id !== void 0 && action.id !== null) t2.seenActionIds.add(action.id);
    }
  }
  function currentStop() {
    return t2.train?.stops[t2.train.index] || null;
  }
  function setNotice(kind, text, diag = "") {
    t2.notice = text ? { kind, text, diag } : null;
    render2();
  }
  async function startFromPlanning() {
    try {
      const data = getClientData() || await loadClientData(t2.win);
      if (!state.character) throw new Error("Character data not received yet. Reload the game page with the advisor installed.");
      const plan = readPlanningTab(document, data);
      if (plan.error) throw new Error(plan.error);
      const houseLevels = {};
      for (const room of Object.values(state.character.characterHouseRoomMap || {})) houseLevels[room.houseRoomHrid] = room.level;
      const skills = {};
      for (const skill of state.character.characterSkills || []) skills[skill.skillHrid] = skill.level;
      const train = buildTrain(plan, data, { owned: inventoryCounts(state.items), houseLevels, skills });
      t2.train = { ...train, made: train.stops, index: 0 };
      t2.train.stops = trainStops(t2.train);
      t2.collapsed = isNarrow();
      t2.notice = null;
      rememberQueuedActions();
      save();
      render2();
      if (train.stops.length) goToCurrent();
    } catch (error) {
      showStandaloneError(error.message);
    }
  }
  function showStandaloneError(text) {
    if (!t2.train) t2.train = { title: "Plan train", stops: [], index: 0, shortages: [], covered: [], warnings: [], failed: true };
    setNotice("bad", text);
  }
  async function goToCurrent() {
    const stop = currentStop();
    if (!stop) return;
    const data = getClientData() || await loadClientData(t2.win);
    const action = data.actionDetailMap[stop.actionHrid];
    const opened = action && await openAction(t2.win, action, data);
    if (currentStop() !== stop) return;
    if (opened) fillPanel();
    else setNotice("warn", `Could not open ${stop.actionName} automatically. Open it yourself (${cap(stop.skill)}) and the count is filled in.`, action ? navDiagnostics() : `${stop.actionHrid} not in game data`);
  }
  function advance(step = 1) {
    if (!t2.train) return;
    clearTimeout(t2.queueClickTimer);
    t2.train.index = Math.max(0, Math.min(t2.train.stops.length, t2.train.index + step));
    t2.notice = null;
    save();
    render2();
    if (currentStop()) goToCurrent();
  }
  function toggleGather(itemHrid) {
    const item = t2.train?.gather?.find((candidate) => candidate.itemHrid === itemHrid);
    if (!item) return;
    item.on = !item.on;
    const done2 = new Set(t2.train.stops.slice(0, t2.train.index).map((stop) => stop.actionHrid));
    const all = trainStops(t2.train);
    const passed = all.filter((stop) => done2.has(stop.actionHrid));
    t2.train.stops = [...passed, ...all.filter((stop) => !done2.has(stop.actionHrid))];
    t2.train.index = passed.length;
    t2.notice = null;
    save();
    render2();
  }
  function endTrain() {
    clearTimeout(t2.queueClickTimer);
    document.querySelectorAll(".mwia-train-target").forEach((node) => node.classList.remove("mwia-train-target"));
    t2.train = null;
    t2.notice = null;
    save();
    render2();
  }
  function fillPanel() {
    const stop = currentStop();
    document.querySelectorAll(".mwia-train-target").forEach((node) => node.classList.remove("mwia-train-target"));
    if (!stop) return;
    const found = findActionPanel(stop.actionName);
    if (!found) return;
    if (t2.filled.get(found.input) !== t2.train.index) {
      t2.filled.set(found.input, t2.train.index);
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
    const index = t2.train.index;
    clearTimeout(t2.queueClickTimer);
    t2.queueClickTimer = setTimeout(() => {
      if (t2.train?.index === index) {
        setNotice("warn", "Nothing reached the queue yet. If your action queue is full, wait for a free slot and click \u201CAdd to queue\u201D again \u2014 or press \u201CNext \u25B8\u201D to move on anyway.");
      }
    }, NOT_QUEUED_AFTER_MS);
  }
  function onGameMessage(type, data) {
    scheduleScan4();
    if (type === "init_character_data") {
      t2.seenActionIds = /* @__PURE__ */ new Set();
      restore();
      rememberQueuedActions();
      render2();
      return;
    }
    if (type !== "actions_updated") return;
    const stop = currentStop();
    let queued = false;
    for (const action of data?.endCharacterActions || []) {
      if (!action || action.id === void 0 || action.id === null || t2.seenActionIds.has(action.id)) continue;
      t2.seenActionIds.add(action.id);
      if (!action.isDone && stop && action.actionHrid === stop.actionHrid) queued = true;
    }
    if (queued) advance();
  }
  var cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  function levelNote(stop) {
    if (stop.level === null || stop.level >= stop.levelRequired) return "";
    return ` <span class="mwia-bad" title="Your ${esc(cap(stop.skill))} level is ${stop.level}">\u26A0 needs ${esc(cap(stop.skill))} ${stop.levelRequired}</span>`;
  }
  function render2() {
    if (!t2.root) return;
    const train = t2.train;
    t2.root.classList.toggle("mwia-hidden", !train);
    t2.root.classList.toggle("mwia-train-low", t2.low);
    if (!train) return;
    const stop = currentStop();
    const done2 = train.index >= train.stops.length && !train.failed;
    const headline = done2 ? "All stops queued" : stop ? `${train.index + 1}/${train.stops.length} \xB7 ${esc(stop.actionName)} \xD7${n(stop.count)}` : "";
    let html = `<div class="mwia-train-head">
        <button class="mwia-link" data-train="toggle" title="Show or hide the stops">${t2.collapsed ? "\u25B8" : "\u25BE"}</button>
        <b>\u{1F682} ${esc(train.title)}</b>
        <button class="mwia-link mwia-narrow-only" data-train="move" title="Move to the ${t2.low ? "top" : "bottom"} of the screen">\u21C5</button>
        <button class="mwia-link" data-train="end" title="End the train">\u2715</button>
      </div>`;
    if (headline) html += `<div class="mwia-train-now">${headline}</div>`;
    if (t2.notice) html += `<div class="mwia-notice mwia-notice-${t2.notice.kind}">${esc(t2.notice.text)}${t2.notice.diag ? `<div class="mwia-notice-diag">${esc(t2.notice.diag)}</div>` : ""}</div>`;
    if (stop && !train.failed) {
      if (!t2.collapsed) html += `<p class="mwia-dim">Click the game's <b>Add to queue</b>; the next stop opens when the game confirms it.</p>`;
      html += `<div class="mwia-train-buttons">
            <button class="mwia-cart-btn" data-train="back" ${train.index === 0 ? "disabled" : ""}>\u25C2 Back</button>
            <button class="mwia-cart-btn" data-train="open">Open stop</button>
            <button class="mwia-cart-btn" data-train="next">Next \u25B8</button>
          </div>`;
    }
    if (!t2.collapsed && !train.failed) {
      if (done2) {
        html += `<p>Everything is in the queue. When it has finished, ${/→/.test(train.title) ? "upgrade the house room" : "the goal items are ready"}.</p>`;
      }
      html += `<ol class="mwia-train-stops">${train.stops.map((s, i) => `<li class="${i < train.index ? "mwia-train-done" : i === train.index ? "mwia-train-current" : ""}">
                <span>${esc(s.actionName)}</span> <span class="mwia-num"${s.gather ? ` title="${n(s.count)} actions give about ${n(s.output)}; ${n(s.need)} needed"` : ""}>\xD7${n(s.count)}</span>
                <span class="mwia-dim">${esc(cap(s.skill))}</span>${levelNote(s)}${s.gather && i >= train.index ? ` <button class="mwia-link" data-train="gather" data-item="${esc(s.itemHrid)}" title="Buy ${esc(s.name)} instead of gathering it">buy instead</button>` : ""}</li>`).join("")}</ol>`;
      if (!train.stops.length) html += `<p>Nothing needs to be made \u2014 your inventory already covers the plan.</p>`;
      if (train.covered.length) html += `<p class="mwia-dim">Already in inventory: ${esc(train.covered.join(", "))}</p>`;
      const buyable = toBuy(train).filter((s) => s.itemHrid !== "/items/coin");
      const coins5 = train.shortages.find((s) => s.itemHrid === "/items/coin");
      const gatherable = new Map((train.gather || []).map((item) => [item.itemHrid, item]));
      const gatherButton = (s) => {
        const item = gatherable.get(s.itemHrid);
        if (!item) return "";
        return ` <button class="mwia-link" data-train="gather" data-item="${esc(s.itemHrid)}" title="Gather it yourself (${esc(cap(item.skill))} ${item.levelRequired})">gather</button>${levelNote(item)}`;
      };
      if (buyable.length) {
        html += `<p><b>Missing materials:</b> ${buyable.map((s) => `${esc(s.name)} \xD7${n(s.need)}${gatherButton(s)}`).join(", ")}
              <button class="mwia-cart-btn" data-train="cart" title="Add the missing materials to the MWITools shopping cart">\u{1F6D2} Add to cart</button></p>`;
      }
      if (coins5) html += `<p class="mwia-warn">Coins short: ${n(coins5.need)}</p>`;
      for (const warning of train.warnings) html += `<p class="mwia-warn">\u26A0 ${esc(warning)}</p>`;
    }
    t2.root.innerHTML = html;
  }
  async function onClick5(event) {
    const button = event.target.closest("[data-train]");
    if (!button) return;
    const action = button.dataset.train;
    if (action === "toggle") {
      t2.collapsed = !t2.collapsed;
      render2();
    } else if (action === "move") {
      t2.low = !t2.low;
      try {
        localStorage.setItem(LOW_KEY, t2.low ? "1" : "");
      } catch {
      }
      render2();
    } else if (action === "end") endTrain();
    else if (action === "back") advance(-1);
    else if (action === "next") advance(1);
    else if (action === "open") {
      t2.notice = null;
      render2();
      goToCurrent();
    } else if (action === "gather") toggleGather(button.dataset.item);
    else if (action === "cart") {
      const items = toBuy(t2.train).filter((s) => s.itemHrid !== "/items/coin").map((s) => ({ hrid: s.itemHrid, quantity: s.need, enhancementLevel: 0 }));
      try {
        const outcome = await addToCart(t2.win, items);
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
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mwia-train-start";
      button.textContent = "\u{1F682} Plan train";
      button.title = "Combat Advisor: walk through these production steps in order, with counts filled in";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startFromPlanning();
      });
      bar.appendChild(button);
    }
  }
  var scanQueued = false;
  function scheduleScan4() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      injectStartButtons();
      showPlanCosts(t2.win);
      if (currentStop()) fillPanel();
    });
  }
  function mountPlanTrain(win2) {
    t2.win = win2;
    t2.root = document.createElement("div");
    t2.root.className = "mwia-train mwia-hidden";
    t2.root.addEventListener("click", onClick5);
    enableTapTips(t2.root);
    document.body.appendChild(t2.root);
    try {
      t2.low = !!localStorage.getItem(LOW_KEY);
    } catch {
      t2.low = false;
    }
    restore();
    rememberQueuedActions();
    render2();
    onStateChange(onGameMessage);
    new MutationObserver(scheduleScan4).observe(document.body, { childList: true, subtree: true });
    scheduleScan4();
  }

  // src/main.js
  var win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  installSocketHook(win);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mount());
  } else {
    mount();
  }
  function mount() {
    mountUI(win, worker_source_default);
    mountPlanTrain(win);
    startPriceHistory(win);
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

