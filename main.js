const search = document.getElementById('search');
const rows = document.querySelectorAll('#rows tr');

function stringMatch(name, query) {
	name = name.toLowerCase().trim().replace(/\s/g, '');
	query = query.toLowerCase().trim().replace(/\s/g, '');

	let qIdx = 0;
	let out = '';

	for(let i = 0; i < name.length; i++) {
		if(name[i] === query[qIdx]) {
			out += '<span class="match">';

			while(name[i] && query[qIdx] && name[i] === query[qIdx]) {
				out += name[i];
				qIdx++;
				i++;
			}

			out += '</span>';
			if(i >= name.length) break;
		}

		out += name[i];
	}

	return qIdx >= query.length ? out : undefined;
}

function filterRows() {
	const query = search.value.trim();
	const emptyQuery = !query || query.length === 0;
	let altrow = false;
	let hasRows = emptyQuery;

	rows.forEach(row => {
		const numberCell = row.querySelector('.number');
		const nameCell = row.querySelector('.name');

		if(emptyQuery) {
			nameCell.textContent = nameCell.dataset.name;
			row.classList.remove('is-hidden');
			row.classList.toggle('is-altrow', altrow);
			altrow = !altrow;
			return;
		}

		const numberMatch = stringMatch(numberCell.textContent, query);
		const nameMatch = stringMatch(nameCell.dataset.name, query);
		const match = numberMatch || nameMatch;
		row.classList.toggle('is-hidden', !match);

		if(match) {
			hasRows = true;
			row.classList.toggle('is-altrow', altrow);
			altrow = !altrow;
		}
		
		if(nameMatch) {
			nameCell.innerHTML = nameMatch;
		}else{
			nameCell.textContent = nameCell.dataset.name;
		}
	});

	document.querySelector('.no-rows')?.classList.toggle('is-hidden', hasRows);
	document.querySelector('.clear-search')?.classList.toggle('is-hidden', emptyQuery);
}

function clearSearch() {
	search.value = '';
	filterRows();
}

document.addEventListener('keyup', (e) => {
	if(e.key === 'Escape') {
		e.preventDefault();
		clearSearch();
	}
});

document.addEventListener('keypress', (e) => {
	if(document.activeElement.tagName === 'INPUT') return;
	if(e.key === '/') {
		e.preventDefault();
		search.focus();
	}
});

search.addEventListener('input', filterRows);
search.focus();
filterRows();
