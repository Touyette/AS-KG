import fs from 'node:fs';

// The path part of the published baseUrl — "/AS-KG" for a project page, "" for
// a domain root. Read from the config so it cannot drift from what deploys.
//
// The standalone pages need it because they are not Quartz pages: when Quartz's
// SPA router morphs one into view it re-inserts their <script src> resolved
// against the URL you came *from*, so a relative src silently 404s.
export function basePath(config = 'quartz.config.yaml') {
  try {
    const m = /^\s*baseUrl:\s*"?([^"\s#]+)"?/m.exec(fs.readFileSync(config, 'utf8'));
    if (!m) return '';
    return new URL('https://' + m[1].replace(/^https?:\/\//, '')).pathname.replace(/\/$/, '');
  } catch {
    return '';
  }
}
