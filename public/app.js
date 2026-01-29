async function postForm(url, form) {
  const res = await fetch(url, { method: 'POST', body: form });
  return res.json();
}

function el(id){ return document.getElementById(id); }

// wire slider labels
[ ['contrastLow','contrastLowVal'], ['contrastHigh','contrastHighVal'], ['threshold','thresholdVal'] ].forEach(([s,v]) => {
  const slider = el(s);
  const val = el(v);
  slider.addEventListener('input', () => val.textContent = slider.value);
});

el('previewBtn').addEventListener('click', async () => {
  const file = el('pdfFile').files[0];
  if (!file) { alert('Pick a PDF first'); return; }
  const form = new FormData();
  form.append('pdf', file);
  form.append('pages', el('pages').value);
  form.append('dpi', el('dpi').value);
  form.append('contrastStretch', el('contrastStretch').checked ? '1' : '0');
  form.append('contrastLowPercent', el('contrastLow').value);
  form.append('contrastHighPercent', el('contrastHigh').value);
  form.append('thresholdPercent', el('threshold').value);
  form.append('normalize', el('normalize').checked ? '1' : '0');

  el('previewList').innerHTML = 'Generating preview...';
  try {
    const data = await postForm('/convert/preview', form);
    if (data.error) {
      el('previewList').innerHTML = 'Preview error: ' + (data.details || data.error);
      return;
    }
    if (!data.magickAvailable) {
      const note = document.createElement('div');
      note.style.color = 'orange';
      note.textContent = 'ImageMagick not found on server — preprocessing not applied.';
      el('previewList').appendChild(note);
    }
    el('previewList').innerHTML = '';
    data.previews.forEach(p => {
      const div = document.createElement('div');
      div.className = 'previewItem';
      const img = document.createElement('img');
      img.src = p.pngBase64;
      const cap = document.createElement('div');
      cap.textContent = 'Page ' + p.page;
      div.appendChild(img);
      div.appendChild(cap);
      el('previewList').appendChild(div);
    });
  } catch (e) {
    el('previewList').innerHTML = 'Preview failed: ' + e;
  }
});

el('submitBtn').addEventListener('click', async () => {
  const file = el('pdfFile').files[0];
  if (!file) { alert('Pick a PDF first'); return; }
  const form = new FormData();
  form.append('pdf', file);
  form.append('contrastStretch', el('contrastStretch').checked ? '1' : '0');
  form.append('contrastLowPercent', el('contrastLow').value);
  form.append('contrastHighPercent', el('contrastHigh').value);
  form.append('thresholdPercent', el('threshold').value);
  form.append('normalize', el('normalize').checked ? '1' : '0');
  form.append('dpi', el('dpi').value);

  el('jobStatus').textContent = 'Submitting...';
  try {
    const res = await fetch('/convert', { method: 'POST', body: form });
    const data = await res.json();
    if (res.status !== 202) {
      el('jobStatus').textContent = 'Submit error: ' + (data.error || JSON.stringify(data));
      return;
    }
    el('jobStatus').textContent = 'Job queued: ' + data.jobId;
    pollJob(data.jobId);
  } catch (e) {
    el('jobStatus').textContent = 'Submit failed: ' + e;
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
