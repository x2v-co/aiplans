import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync, chmodSync, symlinkSync, readFileSync, writeFileSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileJournal, type Prepared } from './file-journal';
import { digest } from './exact';
const prepared: Prepared = { version:'o3-sparse-v1',planDigest:'a'.repeat(64),schemaDigest:'b'.repeat(64),
  sourceModel:{id:'3014',max_output_tokens:'9223372036854775806',updated_at:'2026-09-03 19:22:05.123450+00'},
  fk:{table:'api_channel_prices',id:15031,old:3014,next:3192},alias:{old_slug:'o3-(batch)',model_id:3192,reason:'own',created_at:'2026-11-17 00:00:00+00'},inputFingerprint:'a'.repeat(64) };
function sandbox(work:(p:string)=>void) { const p=mkdtempSync(join(tmpdir(),'o3-journal-'));try { work(p); } finally { rmSync(p,{recursive:true,force:true}); } }
test('journal private immutable no-clobber publication, restart, exact bigint/microseconds and content hash',()=>sandbox(root=>{
  const directory=join(root,'journal');const j=new FileJournal(directory);
  assert.equal(j.publish(prepared),digest(prepared));
  assert.equal(statSync(directory).mode & 0o777,0o700);
  const file=join(directory,prepared.planDigest+'.json');assert.equal(statSync(file).mode & 0o777,0o600);
  assert.deepEqual(new FileJournal(directory).read(prepared.planDigest),prepared);
  assert.equal(j.publish(prepared),digest(prepared));
  const original=readFileSync(file,'utf8');assert.throws(()=>j.publish({...prepared,sourceModel:{id:'OTHER'}}),/differs/);
  assert.equal(readFileSync(file,'utf8'),original);
  assert.throws(()=>j.read('../escape'));
  chmodSync(file,0o644);assert.throws(()=>j.read(prepared.planDigest),/private/);
}));
test('journal rejects symlinks, path traversal, unsafe modes, hardlinks and noncanonical tampering',()=>sandbox(root=>{
  const directory=join(root,'journal');const j=new FileJournal(directory);j.publish(prepared);
  symlinkSync(directory,join(root,'alias'));assert.throws(()=>new FileJournal(join(root,'alias')));
  assert.throws(()=>new FileJournal(join(root,'alias','child')));
  assert.throws(()=>new FileJournal(directory+'/../journal'));
  const path=join(directory,prepared.planDigest+'.json');
  linkSync(path,join(root,'hard'));assert.throws(()=>j.read(prepared.planDigest));rmSync(join(root,'hard'));
  writeFileSync(path,' {}\n');assert.throws(()=>j.read(prepared.planDigest));
  rmSync(path);symlinkSync(join(root,'missing'),path);assert.throws(()=>j.read(prepared.planDigest));
  chmodSync(directory,0o755);assert.throws(()=>new FileJournal(directory),/0700/);
}));
test('prepared evidence has no status claim, channel/quota opaque fields or target beforeimage',()=>{
  assert.deepEqual(Object.keys(prepared).sort(),['version','planDigest','schemaDigest','sourceModel','fk','alias','inputFingerprint'].sort());
  assert.doesNotMatch(JSON.stringify(prepared),/notes|payload|APPLIED|RESTORED|targetModel/);
});

test('restart reconciles a crash between no-clobber publication and staging unlink',()=>sandbox(root=>{
  const directory=join(root,'journal');const j=new FileJournal(directory);j.publish(prepared);
  linkSync(join(directory,prepared.planDigest+'.json'),join(directory,'.prepare-'+'c'.repeat(32)));
  assert.deepEqual(new FileJournal(directory).read(prepared.planDigest),prepared);
  assert.equal(statSync(join(directory,prepared.planDigest+'.json')).nlink,1);
}));
