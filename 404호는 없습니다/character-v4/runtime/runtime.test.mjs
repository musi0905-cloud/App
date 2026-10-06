import assert from 'node:assert/strict';
import {actorPlacement,travelPhase,actorFilter,MODES} from './replay.js';
const places=['lobby','lobbySide','hall','elevator','stairs','parking','door','hallSide','elevatorLobby','stairsUp','parkingSide','doorFar','lobbyTop'];
let checks=0;
for(let look=1;look<=8;look++)for(const location of places)for(const action of ['enter','cross','descend','wait','turn','wave','knock','phone'])for(const mode of MODES)for(const phase of [0,.01,.25,.5,.75,.99,1]){
 const scene={location,action,mode}; const p=actorPlacement(scene,phase,look);
 assert.ok([p.x,p.y,p.h].every(Number.isFinite),JSON.stringify(scene));
 assert.ok(p.h>0);
 const frame=travelPhase(scene,phase,look);
 assert.ok(Number.isFinite(frame)&&frame>=-1&&frame<8);
 assert.equal(frame,travelPhase(scene,phase,look),'seeking must be deterministic');
 assert.ok(actorFilter(location,mode).length>0);checks++;
}
assert.equal(actorPlacement({location:'doorFar',action:'enter',mode:'normal'},.5).x,495);
assert.equal(travelPhase({location:'lobby',action:'wait',mode:'normal'},.5),-1);
assert.equal(travelPhase({location:'lobby',action:'enter',mode:'repeat'},.5),0);
console.log(JSON.stringify({passed:true,geometryAndSeekCases:checks,allLooks:8,locations:places.length}));
