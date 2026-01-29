async function postForm(url, form) {
  const res = await fetch(url, { method: 'POST', body: form });
  return res.json();
}

function el(id){ return document.getElementById(id); }

function setBusy(isBusy){
  el('previewBtn').disabled = isBusy;
  el('submitBtn').disabled = isBusy;
}

// wire slider labels
[ ['contrastLow','contrastLowVal'], ['contrastHigh','contrastHighVal'], ['threshold','thresholdVal'] ].forEach(([s,v]) => {
  const slider = el(s);
  const val = el(v);
  slider.addEventListener('input', () => val.textContent = slider.value);
});

el('previewBtn').addEventListener('click', async () => {
  const file = el('pdfFile').files[0];
  if (!file) { alert('Pick a PDF first'); return; }
  setBusy(true);
  const form = new FormData();
  form.append('pdf', file);
  form.append('pages', el('pages').value);
  form.append('dpi', el('dpi').value);
  form.append('contrastStretch', el('contrastStretch').checked ? '1' : '0');
  form.append('contrastLowPercent', el('contrastLow').value);
  form.append('contrastHighPercent', el('contrastHigh').value);
  form.append('thresholdPercent', el('threshold').value);
  form.append('normalize', el('normalize').checked ? '1' : '0');

  el('previewList').innerHTML = '<div class="card"><span class="spinner"></span> Generating preview...</div>';
  try {
    const data = await postForm('/convert/preview', form);
    if (data.error) {
      el('previewList').innerHTML = 'Preview error: ' + (data.details || data.error);
      return;
    }
    el('previewList').innerHTML = '';
    if (!data.magickAvailable) {
      const note = document.createElement('div');
      note.className = 'muted small';
      note.textContent = 'ImageMagick not found on server — preprocessing not applied.';
      el('previewNotice').textContent = note.textContent;
    } else {
      el('previewNotice').textContent = '';
    }
    data.previews.forEach(p => {
      const div = document.createElement('div');
      div.className = 'previewItem';
      const img = document.createElement('img');
      img.src = p.pngBase64;
      const cap = document.createElement('div');
      cap.className = 'cap';
      cap.textContent = 'Page ' + p.page + (p.preprocessed ? ' (preprocessed)' : '');
      div.appendChild(img);
      div.appendChild(cap);
      el('previewList').appendChild(div);
    });
    setBusy(false);
  } catch (e) {
    el('previewList').innerHTML = 'Preview failed: ' + e;
    setBusy(false);
  }
});

el('submitBtn').addEventListener('click', async () => {
  const file = el('pdfFile').files[0];
  if (!file) { alert('Pick a PDF first'); return; }
  setBusy(true);
  const form = new FormData();
  form.append('pdf', file);
  form.append('contrastStretch', el('contrastStretch').checked ? '1' : '0');
  form.append('contrastLowPercent', el('contrastLow').value);
  form.append('contrastHighPercent', el('contrastHigh').value);
  form.append('thresholdPercent', el('threshold').value);
  form.append('normalize', el('normalize').checked ? '1' : '0');
  form.append('dpi', el('dpi').value);

  el('jobStatus').innerHTML = '<span class="spinner"></span> Submitting...';
  try {
    const res = await fetch('/convert', { method: 'POST', body: form });
    const data = await res.json();
    if (res.status !== 202) {
      el('jobStatus').textContent = 'Submit error: ' + (data.error || JSON.stringify(data));
      setBusy(false);
      return;
    }
    el('jobStatus').textContent = 'Job queued: ' + data.jobId;
    setBusy(false);
    pollJob(data.jobId);
  } catch (e) {
    el('jobStatus').textContent = 'Submit failed: ' + e;
    setBusy(false);
  }
});

async function pollJob(jobId) {
  el('jobStatus').textContent = 'Polling job ' + jobId + '...';
  const url = '/convert/' + jobId;
  const interval = 2000;
  const timer = setInterval(async () => {
    try {
      const r = await fetch(url);
      const j = await r.json();
      if (j.status === 'done') {
        clearInterval(timer);
        el('jobStatus').innerHTML = `Done. <a href="/${j.txtPath}" target="_blank">Download text</a>`;
      } else if (j.status === 'failed') {
        clearInterval(timer);
        el('jobStatus').textContent = 'Failed: ' + (j.error || 'unknown');
      } else {
        el('jobStatus').textContent = `Status: ${j.status}`;
      }
    } catch (e) {
      console.error('poll error', e);
    }
  }, interval);
}
