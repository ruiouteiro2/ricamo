import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {Repository} from '../desktop/repository.mjs';
import {createState} from '../core/application.mjs';
import {saveMaterial,saveSupplier} from '../core/inventory.mjs';
import {savePurchase} from '../core/purchasing.mjs';
mkdirSync('.runtime',{recursive:true});const data=mkdtempSync(resolve('.runtime/supplier-order-totals-'));
const state=createState();state.settings.language='en';let serial=0;const ctx={id:()=>`fixture-${++serial}`,now:'2026-11-03T12:00:00.000Z',operationId:'fixture'};
for(const [id,name] of [['casa','Casa Cenina'],['other','Other supplier']])saveSupplier(state,{id,name},ctx);
for(const [id,name,supplierId,currency,quantity,unitPrice,status] of [
 ['red','Red','casa','EUR',2,150,'to_buy'],['blue','Blue','casa','EUR',3,250,'to_buy'],['usd','USD item','casa','USD',1,400,'to_buy'],['missing','No price','casa','EUR',1,null,'to_buy'],['other','Other item','other','EUR',4,100,'to_buy'],['cancelled','Cancelled','casa','EUR',1,999,'cancelled'],['unknown','Unassigned',null,'EUR',1,null,'to_buy']
]){saveMaterial(state,{id,name,category:'thread',unit:'skein'},ctx);savePurchase(state,{id:`order-${id}`,materialId:id,supplierId,currency,quantity,unitPrice,status},ctx);}
let repository=new Repository(join(data,'ricamo.sqlite'));repository.restore({state,assets:[]},0);repository.close();
const env={...process.env,RICAMO_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const app=await electron.launch({chromiumSandbox:true,executablePath:resolve(process.env.RICAMO_EXECUTABLE),args:process.env.RICAMO_TEST_SOURCE?['.']:[],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.locator('.sidebar').waitFor();await page.locator('.sidebar').getByRole('button',{name:'Shopping',exact:true}).click();
 const summary=page.getByRole('region',{name:'Order total by supplier'}),casa=summary.locator('.supplier-order-total').filter({has:page.getByRole('heading',{name:'Casa Cenina',exact:true})});
 await expect(casa).toContainText('10.50');await expect(casa).toContainText('4.00');await expect(casa).toContainText('Partial total');
 await page.getByRole('combobox',{name:'Supplier',exact:true}).selectOption('casa');await expect(page.locator('.table-wrap tbody tr')).toHaveCount(4);await expect(summary.locator('.supplier-order-total')).toHaveCount(1);
 await page.getByRole('button',{name:'Edit purchase: No price',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Price per unit',{exact:true}).fill('2.00');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(casa).toContainText('12.50');await expect(casa).not.toContainText('Partial total');
 await page.getByRole('combobox',{name:'Supplier',exact:true}).selectOption('other');await expect(summary).toContainText('Other supplier');await expect(summary).toContainText('4.00');await expect(summary).not.toContainText('12.50');
 await page.getByRole('combobox',{name:'Supplier',exact:true}).selectOption('@unassigned');await expect(summary).toContainText('Prices not recorded');await expect(summary).not.toContainText('0.00');
 repository=new Repository(join(data,'ricamo.sqlite'));try{const saved=repository.load();assert.equal(saved.purchases.find(r=>r.id==='order-missing').unitPrice,200);assert.equal(saved.purchases.find(r=>r.id==='order-missing').supplierId,'casa');assert.equal(saved.movements.length,0);}finally{repository.close();}
 assert.deepEqual(errors,[]);await page.screenshot({path:join(data,'supplier-totals.png')});console.log('PASS: supplier filter, recorded prices, missing prices, currencies and persisted updates. '+data);
}catch(error){await page.screenshot({path:join(data,'failure.png')});throw error;}finally{await app.close();}
