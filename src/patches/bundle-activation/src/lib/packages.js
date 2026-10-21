export const packages = [
  {id:'bundle-custom-order',name:'Custom Growth Tier',price:0,status:'active',networks:['instagram','tiktok','youtube'],hasRefill:false,refillDurationDays:0,smmGlobServiceId:null},
  {id:'bundle-launch-pack',name:'Launch Bundle',price:44.85,status:'active',networks:['instagram','tiktok','youtube'],paymentGateway:'paykings',hasRefill:true,refillDurationDays:30,quantity:1000,smmGlobServiceId:4122},
  {id:'bundle-momentum-pack',name:'Momentum Bundle',price:89.85,status:'active',networks:['instagram','tiktok','youtube'],paymentGateway:'paykings',hasRefill:true,refillDurationDays:30,quantity:2500,smmGlobServiceId:5831},
  {id:'bundle-leofame-autolikes',name:'Automated Auto-Likes (30 Posts)',price:29.99,status:'active',isAutoLikes:true,minLikes:100,maxLikes:120,postsToCover:30,providerServiceIds:{autosm:1420,smmglory:3110,smmcpan:4910}}
];
export function findPackageById(id){return packages.find(p=>p.id===id)||null;}
