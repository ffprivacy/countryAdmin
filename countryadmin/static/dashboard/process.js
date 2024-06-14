

function processCompositionElement(process, composition) {
    const compositionDiv = document.createElement('div');
    compositionDiv.className = 'composition-process-group mb-2';

    compositionDiv.innerHTML = `
        <label>Process ID:</label>
        <input type="number" name="composition-process-id" value="${composition.id}" class="form-control mr-2">
        <label>Amount:</label>
        <input type="number" name="composition-process-amount" value="${composition.amount}" class="form-control mr-2">
        <button class="btn btn-primary mr-2" onclick="processCompositionUpdate(${process.id}, this.parentNode)">Update</button>
        <button class="btn btn-danger" onclick="Processes.compositionDelete(${process.id}, ${composition.id})">Delete</button>
    `;

    return compositionDiv;
}
function processCompositionUpdate(process_id, compositionDiv) {
    const processIdInput = compositionDiv.querySelector('input[name="composition-process-id"]');
    const processAmountInput = compositionDiv.querySelector('input[name="composition-process-amount"]');
    const updatedComposition = {
        id: parseInt(processIdInput.value, 10),
        amount: parseInt(processAmountInput.value, 10)
    };
    Processes.compositionUpdate(process_id, updatedComposition);
}
function addProcessCompositionGuess() {
	const processTitle = document.getElementById("add-process-title");
	const contextInput = document.getElementById("add-process-composition-guess-context");
	/**
	 * plain text describing country, etc contextInput.value
	 * Depuis des informations comme le pays le type de process que l'on veut créer,
	 * un guess de la composition est fait, par exemple "Administrer mon village x" va probablement
	 * utiliser les mêmes processus que les autres sur les routes, la signalisation mais veut ajouter certains
	 * process plus spécialement pour être au plus près du territoire
	 */
	console.warn("plain text describing country: " + contextInput.value + " for process '" + processTitle.value + "'");
	addProcessAddComposition(id=1,amount=2);
}
function processCreateElement(allProcesses,process) {
	const process_selected = 0 < process.amount;
	const process_amount = process.amount;
	const e = document.createElement('div');
	e.className = "accordion-item";
	e.setAttribute("process-id", process.id);
	e.setAttribute("metrics", JSON.stringify(process.metrics));
	e.setAttribute("title", process.title);
	e.setAttribute("process-amount", process.amount);
	const compoStr = JSON.stringify(process.composition);
	e.setAttribute("process-composition", compoStr);

	e.innerHTML = `
		<div class="accordion-header" id="process-list-process-${process.id}-title">
			<div class="accordion-button d-flex justify-content-between align-items-center p-3 collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#process-list-process-${process.id}-body" aria-expanded="true" aria-controls="process-list-process-${process.id}-body">
				<form action="/api/select_process" method="POST" class="me-3">
					<input type="checkbox" ${process_selected ? "checked" : ""}>
					<input type="hidden" name="id" value="${process.id}">
					<input type="hidden" name="selected" value="${process_selected ? 1 : 0}">
				</form>
				<strong class="me-auto">${process.title} (ID: ${process.id})</strong>
				<button class="btn btn-danger btn-sm" onclick="Processes.delete(${process.id})">Delete</button>
			</div>
		</div>
		<div id="process-list-process-${process.id}-body" class="accordion-collapse collapse" aria-labelledby="process-list-process-${process.id}-title" data-bs-parent="#process-list">
			<div class="row p-3">
				<div class="col-md-4">
					<h6>Amount</h6>
					<ul class="list-unstyled">
						<li><input type="number" class="form-control mt-2" id="view-process-amount-${process.id}" value="${process_amount}" /></li>
					</ul>
				</div>
				<div class="col-md-4">
					<h6>Process input</h6>
					<ul class="list-unstyled" id="process-view-metrics-input"></ul>
				</div>
				<div class="col-md-4">
					<h6>Process output</h6>
					<ul class="list-unstyled" id="process-view-metrics-output"></ul>
				</div>
			</div>
			<hr>
			<div class="row">
				<h6 class="mt-3">Cumulative Metrics</h6>
			</div>
			<div class="row">
				<div class="col-md-4">
					For ${Processes.countSubProcesses(allProcesses,process)} subprocess
				</div>
				<div class="col-md-4">
					<h6>Process input</h6>
					<ul class="list-unstyled" id="process-view-cumulative-metrics-input"></ul>
				</div>
				<div class="col-md-4">
					<h6>Process output</h6>
					<ul class="list-unstyled" id="process-view-cumulative-metrics-output"></ul>
				</div>
			</div>
			<hr>
			<div class="row">
				<div class="col">
					<h6>Composition</h6>
					<div id="composition-container-${process.id}">
					</div>
				</div>
			</div>
			<hr>
			<div class="row">
				<div class="col-md-4">
					<button class="btn btn-outline-success" onclick="Processes.like(${process.id})">Like</button>
					<button class="btn btn-outline-danger" onclick="Processes.dislike(${process.id})">Dislike</button>
					<p>Score: ${process.like_count || 0}</p>
				</div>
				<div class="col-md-8">
					<h6>Comments</h6>
					<ul class="list-unstyled" id="comments-${process.id}">
						${process.comments.map(comment => `<li><strong>${comment.user}</strong> (${new Date(comment.date).toLocaleString()}): ${comment.text}</li>`).join('')}
					</ul>
					<textarea class="form-control" id="comment-text-${process.id}" rows="2"></textarea>
					<button class="btn btn-primary mt-2" onclick="Processes.addComment(${process.id}, document.getElementById('comment-text-${process.id}').value)">Add Comment</button>
				</div>
			</div>
		</div>
	`;

	for(let sens of ['input','output']) {
		const metricsElement = e.querySelector(`#process-view-metrics-${sens}`);
		for(let metric of Processes.metricsGetIdsList()) {
			const metricElement = document.createElement('li');
			const metricValue = process.metrics[sens][metric] ? process.metrics[sens][metric] : 0;
			if ( 0 < metricValue ) {
				metricElement.textContent = `${metric}: ${metricValue}`;
				metricsElement.appendChild(metricElement);
			}
		}
		const cumulativeMetricsElement = e.querySelector(`#process-view-cumulative-metrics-${sens}`);
		for(let metric of Processes.metricsGetIdsList()) {
			const cumulativeMetricElement = document.createElement('li');
			let metricValue = Processes.retrieveMetric(allProcesses, process, sens, metric);
			if ( isNaN(metricValue) ) {
				metricValue = 0;
			}
			if ( 0 < metricValue ) {
				cumulativeMetricElement.textContent = `${metric}: ${metricValue}`;
				cumulativeMetricsElement.appendChild(cumulativeMetricElement);
			}
		}
	}
	const compositionContainer = e.querySelector(`#composition-container-${process.id}`);
	process.composition.forEach(composition => {
		compositionContainer.appendChild(processCompositionElement(process, composition));
	});

	const amountInput = e.querySelector(`#view-process-amount-${process.id}`);
	amountInput.addEventListener('change', () => {
		const newAmount = amountInput.value;
		fetch(`/api/update_process_usage/${process.id}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				usage_count: newAmount
			})
		})
		.then(response => response.json())
		.then(updatedProcess => {
			console.log(`Process ${updatedProcess.id} amount updated to ${newAmount}`);
			dashboardRefresh();
		})
		.catch(error => console.error('Error updating process amount:', error));
	});

	const form = e.querySelector('form');
	const checkbox = form.querySelector('input[type="checkbox"]');
	const processState = form.querySelector('input[type="hidden"][name="selected"]');
	const processId = form.querySelector('input[type="hidden"][name="id"]');


	checkbox.addEventListener('click', function (e) {
		processState.value = checkbox.checked ? 1 : 0;
		const formData = new FormData();
		formData.append('id', processId.value);
		formData.append('selected', processState.value);
		fetch('/api/select_process', {
			method: 'POST',
			body: formData
		})
			.then(() => dashboardRefresh())
			.catch(function (e) {
				console.warn(e);
			});
	});
	return e;
}
function addProcessAddComposition(id='',amount='') {
	const compositionContainer = document.getElementById('add-process-composition-container');
	const compositionDiv = document.createElement('div');
	compositionDiv.className = 'composition-process-group';
	compositionDiv.innerHTML = `
		<label>Process ID:</label>
		<input type="number" name="composition-process-id" value=${id}>
		<label> Amount:</label>
		<input type="number" name="composition-process-amount" value=${amount}>
	`;
	compositionContainer.appendChild(compositionDiv);
}
function addProcessSetup() {
	addProcessMetricsForm('input');
	addProcessMetricsForm('output');

	const addCompositionBtn = document.getElementById('add-process-add-composition');
	addCompositionBtn.addEventListener('click', () => {
		addProcessAddComposition();
	});
}
function addProcessMetricsForm(sens='input') {
    const container = document.createElement('div');
    container.className = 'row';

    Processes.metricsGetList().forEach(metric => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group p-2 col-md-6 card card group';

        const label = document.createElement('label');
        label.htmlFor = `add-process-metric-${sens}-${metric.id}`;
        label.textContent = metric.label;
        formGroup.appendChild(label);

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-control';
        input.id = `add-process-metric-${sens}-${metric.id}`;
        input.name = `add-process-metric-${sens}-${metric.id}`;
        input.value = 0;
        formGroup.appendChild(input);

        container.appendChild(formGroup);
    });

    document.getElementById(`add-process-metrics-${sens}`).appendChild(container);
}
function addProcessGetCompositionData() {
	const compositionContainer = document.getElementById('add-process-composition-container');
	const compositionDivs = compositionContainer.querySelectorAll('div');
	const compositionArray = Array.from(compositionDivs).map(div => {
		const process_id = div.querySelector('input[name="composition-process-id"]').value;
		const processAmount = div.querySelector('input[name="composition-process-amount"]').value;
		return { id: parseInt(process_id, 10), amount: parseInt(processAmount, 10) };
	});
	return compositionArray;
}