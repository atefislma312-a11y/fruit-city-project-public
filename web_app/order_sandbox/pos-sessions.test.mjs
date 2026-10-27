import test from 'node:test';
import assert from 'node:assert/strict';
import {posSessions,cashierRouteAllowed} from './pos-sessions.mjs';

test('cashier sessions expire, revoke, rotate and use current server-side identity',()=>{
 let now=0,user={user_id:'TEST',role_id:'role_cashier',is_active:1},cookie;
 const sessions=posSessions({lookupUser:()=>user,clock:()=>now,ttlMs:100,maxSessions:1});
 const res={setHeader:(k,v)=>cookie=v},req={headers:{},socket:{}};
 sessions.issue(req,res,'TEST');assert.match(cookie,/HttpOnly; SameSite=Strict/);
 req.headers.cookie=cookie.split(';')[0];const old=req.headers.cookie;
 assert.equal(sessions.authenticate(req).role_id,'role_cashier');
 sessions.issue(req,res,'TEST');assert.equal(sessions.authenticate(req),null);
 req.headers.cookie=cookie.split(';')[0];user.role_id='role_manager';
 assert.equal(sessions.authenticate(req).role_id,'role_manager');
 user.is_active=0;assert.equal(sessions.authenticate(req),null);user.is_active=1;
 sessions.issue(req,res,'TEST');req.headers.cookie=cookie.split(';')[0];now=100;
 assert.equal(sessions.authenticate(req),null);
 sessions.issue(req,res,'TEST');req.headers.cookie=cookie.split(';')[0];sessions.logout(req,res);
 assert.equal(sessions.authenticate(req),null);assert.match(cookie,/Max-Age=0/);
 req.headers.cookie=old+'; '+old;assert.equal(sessions.authenticate(req),null);
});

test('cashier authorization denies admin and financial state without required permissions',()=>{
 const cashier={role_id:'role_cashier'};
 assert.equal(cashierRouteAllowed(null,'/api/orders',['pos:create_order']),false);
 assert.equal(cashierRouteAllowed(cashier,'/api/orders',['pos:create_order']),true);
 assert.equal(cashierRouteAllowed(cashier,'/api/admin/anything',['pos:create_order']),false);
 assert.equal(cashierRouteAllowed(cashier,'/api/state',['pos:create_order']),false);
 assert.equal(cashierRouteAllowed(cashier,'/api/invoices',['purchase:create_draft']),false);
 assert.equal(cashierRouteAllowed(cashier,'/api/unknown',['reports:view']),false);
});
