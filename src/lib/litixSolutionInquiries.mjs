import {getLitixSolution} from "./litixSolutions.mjs";
const clean=(x,max)=>typeof x==="string"?x.trim().replace(/\s+/g," ").slice(0,max+1):"";
export const SOLUTION_BUDGETS=Object.freeze(["under-250","250-999","1000-4999","5000-plus","unsure"]);
export function validateSolutionInquiry(input){
 if(!input||typeof input!=="object"||Array.isArray(input))return {ok:false,error:"Invalid request."};
 if(clean(input.faxTrap,100))return {ok:false,spam:true,error:"Invalid inquiry."};
 const name=clean(input.name,100);
 const email=clean(input.email,254).toLowerCase();
 const organization=clean(input.organization,120);
 const slug=clean(input.solution,70);
 const goals=typeof input.goals==="string"?input.goals.trim():"";
 const budget=clean(input.budget,30);
 const offer=getLitixSolution(slug);
 if(name.length<2||name.length>100)return {ok:false,error:"Enter your name (2–100 characters)."};
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return {ok:false,error:"Enter a valid email address."};
 if(organization.length>120)return {ok:false,error:"Business name is too long."};
 if(!offer)return {ok:false,error:"Choose a valid Litix solution."};
 if(!SOLUTION_BUDGETS.includes(budget))return {ok:false,error:"Choose a budget range."};
 if(goals.length<12||goals.length>1500)return {ok:false,error:"Describe the project in 12–1,500 characters."};
 if(input.consent!==true)return {ok:false,error:"Please consent to follow-up about this inquiry."};
 return {ok:true,data:{name,email,organization,solution:offer.slug,solutionName:offer.name,budget,goals}};
}
