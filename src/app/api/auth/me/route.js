import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
export const dynamic='force-dynamic';
export async function GET(req){const u=currentUser(req); return NextResponse.json({user:u?{id:u.sub,email:u.email,name:u.name}:null});}
