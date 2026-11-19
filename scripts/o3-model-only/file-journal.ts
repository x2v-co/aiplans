/** Immutable prepared evidence. DB commit marker is the sole authority for status.
 * No file write is ever treated as evidence that PostgreSQL committed. */
import { constants as C, closeSync, fsyncSync, openSync, readFileSync, writeFileSync, linkSync,
  unlinkSync, lstatSync, mkdirSync, fstatSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { canonical, digest, invariant, requireDigest } from './exact';
import profile from './fixtures/supported-affected-profile.json';
export type Prepared = {
  version: 'o3-sparse-v1'; planDigest: string; schemaDigest: string;
  sourceModel: Record<string, string | null>;
  fk: { table: 'api_channel_prices'; id: 15031; old: 3014; next: 3192 };
  alias: { old_slug: 'o3-(batch)'; model_id: 3192; reason: string; created_at: string };
  inputFingerprint: string;
};
export class FileJournal {
  readonly directory: string;
  constructor(directory: string) {
    invariant(isAbsolute(directory) && resolve(directory) === directory && directory !== parse(directory).root,
      'Journal must be an absolute normalized dedicated directory');
    this.directory = directory;
    // No symlink ancestors, including the final directory. Never follows a caller alias.
    const parents: string[] = [];
    for (let p = dirname(directory); p !== dirname(p); p = dirname(p)) parents.unshift(p);
    for (const p of parents) invariant(lstatSync(p).isDirectory() && !lstatSync(p).isSymbolicLink(), 'Symlink/non-directory journal ancestor');
    try { mkdirSync(directory, { mode: 0o700 }); this.sync(dirname(directory)); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    this.checkDirectory();
  }
  private checkDirectory() {
    const s = lstatSync(this.directory);
    invariant(s.isDirectory() && !s.isSymbolicLink() && (s.mode & 0o777) === 0o700 && s.uid === process.getuid?.(),
      'Journal directory must be owned by this user, mode 0700, no symlink');
  }
  private sync(path = this.directory) { const fd = openSync(path, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW); try { fsyncSync(fd); } finally { closeSync(fd); } }
  read(planDigest: string): Prepared {
    this.checkDirectory();
    const path = join(this.directory, requireDigest(planDigest) + '.json');
    const fd = openSync(path, C.O_RDONLY | C.O_NOFOLLOW);
    try {
      let s = fstatSync(fd);
      // A crash after link publication and before temp unlink can leave a second
      // name for this exact inode. Only our private, exact-pattern staging links
      // may be removed during restart; arbitrary external hardlinks still refuse.
      if (s.nlink > 1) {
        for (const name of readdirSync(this.directory)) if (/^\.prepare-[a-f0-9]{32}$/.test(name)) {
          const staging = join(this.directory,name);const st=lstatSync(staging);
          if (st.isFile() && st.dev === s.dev && st.ino === s.ino && st.uid === s.uid && (st.mode & 0o777) === 0o600) unlinkSync(staging);
        }
        this.sync();s=fstatSync(fd);
      }
      invariant(s.isFile() && s.nlink === 1 && (s.mode & 0o777) === 0o600 && s.uid === process.getuid?.() && s.size < 1024 * 1024,
        'Journal file must be private, regular, single-link and bounded');
      const raw = readFileSync(fd, 'utf8');
      const value = JSON.parse(raw) as Prepared;
      invariant(raw === canonical(value) + '\n' && value.version === 'o3-sparse-v1' && value.planDigest === planDigest,
        'Journal encoding/identity mismatch');
      invariant(canonical(Object.keys(value).sort()) === canonical(['version','planDigest','schemaDigest','sourceModel','fk','alias','inputFingerprint'].sort())
        && value.sourceModel && Object.getPrototypeOf(value.sourceModel) === Object.prototype
        && Object.entries(value.sourceModel).every(([key,v]) => profile.columns.some(c => c.table==='models' && c.name===key) && (v===null || typeof v==='string')),
        'Journal contains unknown fields/nonpublic beforeimages');
      invariant(canonical(value.fk) === canonical({table:'api_channel_prices',id:15031,old:3014,next:3192})
        && value.alias && canonical(Object.keys(value.alias).sort()) === canonical(['old_slug','model_id','reason','created_at'].sort())
        && value.alias.old_slug==='o3-(batch)' && value.alias.model_id===3192
        && typeof value.alias.reason==='string' && typeof value.alias.created_at==='string', 'Journal FK/alias identity shape mismatch');
      requireDigest(value.schemaDigest);requireDigest(value.inputFingerprint);
      return value;
    } finally { closeSync(fd); }
  }
  publish(value: Prepared): string {
    this.checkDirectory(); requireDigest(value.planDigest);
    const temp = join(this.directory, '.prepare-' + randomBytes(16).toString('hex'));
    const final = join(this.directory, value.planDigest + '.json');
    const fd = openSync(temp, C.O_WRONLY | C.O_CREAT | C.O_EXCL | C.O_NOFOLLOW, 0o600);
    try { writeFileSync(fd, canonical(value) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
    try {
      // link(2) is atomic no-clobber publication. rename(2) alone could replace evidence.
      linkSync(temp, final); this.sync();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      invariant(canonical(this.read(value.planDigest)) === canonical(value), 'Existing journal differs; refusing replacement');
    } finally { unlinkSync(temp); this.sync(); }
    return digest(value);
  }
}
