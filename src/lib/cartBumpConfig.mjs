export const CART_BUMP_QTY=Object.freeze({likes:500,views:1000});
export const cartBumpKind=kind=>(["followers","views"].includes(kind)?"likes":kind==="likes"?"views":null);
