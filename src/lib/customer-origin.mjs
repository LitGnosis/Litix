export function sameOrigin(request,base){
 try{return new URL(base).protocol==='https:'&&request.headers.get('origin')===new URL(base).origin}catch{return false}
}
