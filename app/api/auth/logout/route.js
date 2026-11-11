import { NextResponse } from 'next/server';
import { clearAuthCookie } from '../../../../lib/auth';
export async function POST(){return NextResponse.json({ok:true},{headers:{'set-cookie':clearAuthCookie()}});}
