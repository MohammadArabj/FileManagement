const modal = document.getElementById('fileModal');
const openBtn = document.getElementById('openModal');
const closeBtn = document.getElementById('closeModal');
const form = document.getElementById('uploadForm');
const filesGrid = document.getElementById('files');
const template = document.getElementById('fileCard');

const apiBase = 'https://localhost:5001/api';

openBtn.addEventListener('click', () => {
  modal.classList.add('open');
  refresh();
});

closeBtn.addEventListener('click', () => modal.classList.remove('open'));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  if (!data.get('file')) return;

  const response = await fetch(`${apiBase}/attachment/upload`, {
    method: 'POST',
    body: data,
  });

  if (response.ok) {
    form.reset();
    refresh();
  } else {
    alert('Upload failed');
  }
});

async function refresh() {
  const response = await fetch(`${apiBase}/attachment`);
  if (!response.ok) return;

  const { data } = await response.json();
  filesGrid.innerHTML = '';
  (data || []).forEach((file) => {
    const card = template.content.cloneNode(true);
    card.querySelector('.file-name').textContent = file.fileName;
    card.querySelector('.download').href = `${apiBase}/attachment/download/${file.guid}`;
    card.querySelector('.delete').addEventListener('click', () => remove(file.guid));
    filesGrid.appendChild(card);
  });
}

async function remove(id) {
  const response = await fetch(`${apiBase}/attachment/${id}`, { method: 'DELETE' });
  if (response.ok) refresh();
}
