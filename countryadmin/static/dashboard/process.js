

function processCompositionElement(process, composition) {
	const compositionDiv = document.createElement('div');
	compositionDiv.classList.add('composition-process-group', 'mb-2');

	const processIdLabel = document.createElement('label');
	processIdLabel.textContent = 'Process ID:';
	compositionDiv.appendChild(processIdLabel);

	const processIdInput = document.createElement('input');
	processIdInput.setAttribute('type', 'number');
	processIdInput.setAttribute('name', 'composition-process-id');
	processIdInput.setAttribute('value', composition.id);
	processIdInput.classList.add('form-control', 'mr-2');
	compositionDiv.appendChild(processIdInput);

	const processAmountLabel = document.createElement('label');
	processAmountLabel.textContent = ' Amount:';
	compositionDiv.appendChild(processAmountLabel);

	const processAmountInput = document.createElement('input');
	processAmountInput.setAttribute('type', 'number');
	processAmountInput.setAttribute('name', 'composition-process-amount');
	processAmountInput.setAttribute('value', composition.amount);
	processAmountInput.classList.add('form-control', 'mr-2');
	compositionDiv.appendChild(processAmountInput);

	const updateBtn = document.createElement('button');
	updateBtn.textContent = 'Update';
	updateBtn.classList.add('btn', 'btn-primary', 'mr-2');
	updateBtn.addEventListener('click', () => {
		const updatedComposition = {
			id: parseInt(processIdInput.value, 10),
			amount: parseInt(processAmountInput.value, 10)
		};
		Processes.compositionUpdate(process.id, updatedComposition);
	});
	compositionDiv.appendChild(updateBtn);

	const deleteBtn = document.createElement('button');
	deleteBtn.textContent = 'Delete';
	deleteBtn.classList.add('btn', 'btn-danger');
	deleteBtn.addEventListener('click', () => {
		Processes.compositionDelete(process.id, composition.id);
	});
	compositionDiv.appendChild(deleteBtn);

	return compositionDiv;
}
function processCreateElement(allProcesses,process) {
	const process_selected = 0 < process.amount;
	const process_amount = process.amount;
	const li = document.createElement('li');
	li.classList.add("list-group-item");
	li.setAttribute("process-id", process.id);
	li.setAttribute("metrics", JSON.stringify(process.metrics));
	li.setAttribute("title", process.title);
	li.setAttribute("process-amount", process.amount);
	const compoStr = JSON.stringify(process.composition);
	li.setAttribute("process-composition", compoStr);

	li.innerHTML = `
		<div class="card mb-3">
			<div class="card-header d-flex justify-content-between align-items-center">
				<form action="/api/select_process" method="POST">
					<input type="checkbox" ${process_selected ? "checked" : ""}>
					<input type="hidden" name="id" value="${process.id}">
					<input type="hidden" name="selected" value="${process_selected ? 1 : 0}">
				</form>
				<div>
					<strong>${process.title}</strong> (ID: ${process.id})
				</div>
				<button class="btn btn-danger btn-sm" onclick="Processes.delete(${process.id})">Delete</button>
			</div>
			<div class="card-body">
				<div class="row">
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
		</div>
	`;

	for(let sens of ['input','output']) {
		const metricsElement = li.querySelector(`#process-view-metrics-${sens}`);
		for(let metric of Processes.metricsGetIdsList()) {
			const metricElement = document.createElement('li');
			metricElement.textContent = `${metric}: ${process.metrics[sens][metric]}`;
			metricsElement.appendChild(metricElement);
		}
		const cumulativeMetricsElement = li.querySelector(`#process-view-cumulative-metrics-${sens}`);
		for(let metric of Processes.metricsGetIdsList()) {
			const cumulativeMetricElement = document.createElement('li');
			cumulativeMetricElement.textContent = `${metric}: ${Processes.retrieveMetric(allProcesses, process, sens, metric)}`;
			cumulativeMetricsElement.appendChild(cumulativeMetricElement);
		}
	}
	const compositionContainer = li.querySelector(`#composition-container-${process.id}`);
	process.composition.forEach(composition => {
		compositionContainer.appendChild(processCompositionElement(process, composition));
	});

	const amountInput = li.querySelector(`#view-process-amount-${process.id}`);
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
			fetchProcesses();
		})
		.catch(error => console.error('Error updating process amount:', error));
	});

	const form = li.querySelector('form');
	const checkbox = form.querySelector('input[type="checkbox"]');
	const checkboxS = form.querySelector('input[type="hidden"][name="selected"]');

	checkbox.addEventListener('click', function (e) {
		checkboxS.value = checkbox.checked ? 1 : 0;
		form.submit();
	});
	return li;
}
function addProcessSetup() {
	addProcessMetricsForm('input');
	addProcessMetricsForm('output');

	const addCompositionBtn = document.getElementById('add-process-add-composition');
	addCompositionBtn.addEventListener('click', () => {
		const compositionContainer = document.getElementById('add-process-composition-container');
		const compositionDiv = document.createElement('div');
		compositionDiv.className = 'composition-process-group';
		compositionDiv.innerHTML = `
			<label>Process ID:</label>
			<input type="number" name="composition-process-id">
			<label> Amount:</label>
			<input type="number" name="composition-process-amount">
		`;
		compositionContainer.appendChild(compositionDiv);
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
		const processId = div.querySelector('input[name="composition-process-id"]').value;
		const processAmount = div.querySelector('input[name="composition-process-amount"]').value;
		return { id: parseInt(processId, 10), amount: parseInt(processAmount, 10) };
	});
	return compositionArray;
}