// ── tabs ────────────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', ['encode', 'decode'][i] === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  // scroll to top so position feels stable
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── state ────────────────────────────────────────────────────────────────────
const FILE_SIZE_LIMIT = 10 * 1024; // 50 KB

let fileBytes = null;
let encodeMode = 'text';
let compressOn = true;
let lastDecoded = null;
let encodeWorker = null;

function switchSource(mode) {
  encodeMode = mode;
  document.getElementById('tab-file').classList.toggle('active', mode === 'file');
  document.getElementById('tab-text').classList.toggle('active', mode === 'text');
  document.getElementById('source-file').style.display = mode === 'file' ? '' : 'none';
  document.getElementById('source-text').style.display = mode === 'text' ? '' : 'none';
  setStatus('encode', '');
}

function onFileChange(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('file-name').textContent = file.name;
  if (file.size > FILE_SIZE_LIMIT) {
    setStatus('encode',
      `file too large — max ${FILE_SIZE_LIMIT / 1024} KB ` +
      `(got ${(file.size / 1024).toFixed(1)} KB)`, true);
    fileBytes = null;
    return;
  }
  setStatus('encode', '');
  const reader = new FileReader();
  reader.onload = e => { fileBytes = new Uint8Array(e.target.result); };
  reader.readAsArrayBuffer(file);
}

function toggleCompress() {
  compressOn = !compressOn;
  document.getElementById('compress-toggle').classList.toggle('on', compressOn);
}

// ── encode ────────────────────────────────────────────────────────────────────
function doEncode() {
  let bytes;
  if (encodeMode === 'file') {
    if (!fileBytes) { setStatus('encode', 'choose a file first.', true); return; }
    bytes = fileBytes;
  } else {
    const text = document.getElementById('text-input').value;
    if (!text) { setStatus('encode', 'enter some text first.', true); return; }
    const encoded = new TextEncoder().encode(text);
    if (encoded.length > FILE_SIZE_LIMIT) {
      setStatus('encode',
        `text too large — max ${FILE_SIZE_LIMIT / 1024} KB ` +
        `(got ${(encoded.length / 1024).toFixed(1)} KB)`, true);
      return;
    }
    bytes = encoded;
  }

  const btn = document.getElementById('encode-btn');
  const cancel = document.getElementById('cancel-btn');
  btn.disabled = true;
  cancel.style.display = '';
  document.getElementById('encode-result').style.display = 'none';
  setStatus('encode', 'starting…');

  encodeWorker = new Worker('worker.js');

  encodeWorker.onmessage = function (e) {
    const { type, prime, metadata, payloadLength } = e.data;
    if (type === 'status') {
      setStatus('encode', e.data.msg);
    } else if (type === 'result') {
      document.getElementById('prime-out').textContent = prime;
      document.getElementById('encode-meta').innerHTML =
        `metadata <span>${metadata}</span> &nbsp;·&nbsp; ` +
        `size <span>${payloadLength} B</span> &nbsp;·&nbsp; ` +
        `digits <span>${prime.length}</span> &nbsp;·&nbsp; ` +
        `compressed <span>${compressOn}</span>`;
      document.getElementById('encode-result').style.display = 'block';
      setStatus('encode', '');
      cleanupWorker();
    } else if (type === 'error') {
      setStatus('encode', e.data.msg, true);
      cleanupWorker();
    }
  };

  encodeWorker.onerror = function (err) {
    setStatus('encode', err.message, true);
    cleanupWorker();
  };

  encodeWorker.postMessage({ fileBytes: Array.from(bytes), compressOn });
}

function doCancel() {
  if (encodeWorker) { encodeWorker.terminate(); encodeWorker = null; }
  setStatus('encode', 'cancelled.');
  cleanupWorker();
}

function cleanupWorker() {
  if (encodeWorker) { encodeWorker.terminate(); encodeWorker = null; }
  document.getElementById('encode-btn').disabled = false;
  document.getElementById('cancel-btn').style.display = 'none';
}

// ── decode ────────────────────────────────────────────────────────────────────
function doDecode() {
  const raw = document.getElementById('prime-input').value.trim();
  if (!raw) { setStatus('decode', 'enter a prime number.', true); return; }

  setStatus('decode', 'decoding…');
  document.getElementById('decode-result').style.display = 'none';

  setTimeout(() => {
    try {
      const prime = BigInt(raw);
      const shifted = prime >> METADATA_BITS;
      const compressed = bigIntToBytes(shifted);

      let data;
      try {
        data = pako.inflate(compressed);
      } catch {
        data = compressed;
      }

      lastDecoded = data;
      document.getElementById('source-out').textContent = new TextDecoder().decode(data);
      document.getElementById('decode-result').style.display = 'block';
      setStatus('decode', `recovered ${data.length} bytes`);
    } catch (e) {
      setStatus('decode', e.message, true);
    }
  }, 30);
}

// ── download ──────────────────────────────────────────────────────────────────
function doDownload() {
  if (!lastDecoded) return;
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([lastDecoded])),
    download: 'recovered',
  });
  a.click();
}

// ── helpers ───────────────────────────────────────────────────────────────────
function setStatus(panel, msg, isError = false) {
  const el = document.getElementById(panel + '-status');
  el.textContent = msg;
  el.className = 'status' + (isError ? ' error' : '');
}

const SAMPLE_C =
`#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
`;

function downloadSample(e) {
  e.preventDefault();
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([SAMPLE_C], { type: 'text/plain' })),
    download: 'hello_world.c',
  });
  a.click();
}

function copyOutput(id, btn) {
  const text = document.getElementById(id).textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('copied'); }, 1500);
  });
}
