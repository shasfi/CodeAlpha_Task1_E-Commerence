import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const projectRoot = path.resolve(import.meta.dirname, '..');
const temp = mkdtempSync(path.join(tmpdir(), 'mono-store-test-'));
const dbFile = path.join(temp, 'test.sqlite');
function freePort() { return new Promise((resolve,reject)=>{ const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});}); }
const port=await freePort();
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server.js'],{ cwd:projectRoot,env:{ ...process.env,PORT:String(port),DB_PATH:dbFile,NODE_ENV:'test' },stdio:['ignore','pipe','pipe'] });
let logs='';server.stderr.on('data',d=>logs+=d.toString());server.stdout.on('data',d=>logs+=d.toString());
for(let n=0;n<80;n++) {try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(400)});if(r.ok)break;}catch{}await delay(80);}
async function api(route,method='GET',body,cookie) {
  const response=await fetch(base+route,{ method,headers:{ ...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}) }, body:body?JSON.stringify(body):undefined });
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}

test('homepage, health, images and seeded catalog', async()=>{
  assert.equal((await api('/api/health')).status,200);
  const homepage=await fetch(base+'/');assert.equal(homepage.status,200);assert.match(await homepage.text(),/mono/);
  const asset=await fetch(base+'/assets/headphones.svg');assert.equal(asset.status,200);assert.match(await asset.text(),/<svg/);
  const products=await api('/api/products');assert.equal(products.body.products.length,8);
  assert.equal((await api('/api/products?category=Audio')).body.products.length,2);
  assert.equal((await api('/api/products/invalid')).status,404);
});

test('registration, secure session, login and transactional checkout', async()=>{
  const email='intern+'+Date.now()+'@example.com';
  const user={name:'Demo Intern',email,password:'securePassword123'};
  assert.equal((await api('/api/orders')).status,401);
  assert.equal((await api('/api/auth/register','POST',{name:'X',email,password:'short'})).status,400);
  const registered=await api('/api/auth/register','POST',user);
  assert.equal(registered.status,201,logs);
  assert.equal(registered.body.user.email,email);
  assert.ok(registered.cookie?.includes('mono_session='));
  const cookie=registered.cookie;
  assert.equal((await api('/api/auth/me','GET',undefined,cookie)).body.user.name,'Demo Intern');
  assert.equal((await api('/api/auth/register','POST',user)).status,409);
  assert.equal((await api('/api/auth/login','POST',{email,password:'wrongPassword'})).status,401);
  const signin=await api('/api/auth/login','POST',{email,password:user.password});assert.equal(signin.status,200);
  const product=(await api('/api/products/arc-wireless-headphones')).body.product;
  const before=product.stock;
  const shipping={ name:'Demo Intern',email,phone:'03001234567',address:'123 University Avenue',city:'Lahore' };
  assert.equal((await api('/api/orders','POST',{...shipping,items:[{id:product.id,quantity:0}]},cookie)).status,400);
  assert.equal((await api('/api/orders','POST',{...shipping,items:[{id:product.id,quantity:before+1}]},cookie)).status,400);
  assert.equal((await api('/api/orders','POST',{...shipping,items:[{id:product.id,quantity:2},{id:product.id,quantity:1}]},cookie)).status,400);
  const checkout=await api('/api/orders','POST',{...shipping,items:[{id:product.id,quantity:2,price:1}]},cookie);
  assert.equal(checkout.status,201,logs);
  assert.equal(checkout.body.order.total,product.price*2,'server must ignore price tampering');
  assert.equal((await api('/api/products/'+product.id)).body.product.stock,before-2);
  const orders=await api('/api/orders','GET',undefined,cookie);
  assert.equal(orders.body.orders.length,1);
  assert.equal(orders.body.orders[0].items[0].quantity,2);
  const logout=await api('/api/auth/logout','POST',{},cookie);assert.equal(logout.status,200);
  assert.equal((await api('/api/auth/me','GET',undefined,cookie)).body.user,null);
});

test.after(()=>{server.kill('SIGTERM');rmSync(temp,{recursive:true,force:true});});
