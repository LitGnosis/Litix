import {runWarriorCycle} from "./cron-engine.js";
import {db} from "./db.js";

let stopped=false;
async function cycle(){
  if(stopped)return;
  try{console.log("litix-warrior-cycle",JSON.stringify(await runWarriorCycle()));}
  catch{console.error("litix-warrior-cycle-failed");}
}
process.on("SIGTERM",()=>{stopped=true;});
process.on("SIGINT",()=>{stopped=true;});
async function main(){
  const minutes=Number(process.env.WARRIOR_INTERVAL_MINUTES||5);
  if(!Number.isInteger(minutes)||minutes<2||minutes>5)throw Error("INVALID_WARRIOR_INTERVAL");
  while(!stopped){
    await cycle();
    await new Promise(resolve=>setTimeout(resolve,minutes*60000));
  }
  await db.$disconnect();
}
void main().catch(()=>{process.exitCode=1;});
