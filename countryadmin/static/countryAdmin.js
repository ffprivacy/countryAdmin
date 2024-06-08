function processRetrieveMetric(allProcesses, process, metric) {
	let total = 0;
	function getProcessById(processes, id) {
		return processes.find(process => process.id === id);
	}
	for (let compo of process.composition) {
		let compoProcess = getProcessById(allProcesses, compo.id);
		if (compoProcess === undefined) {
			console.warn("process with id " + compo.id + " is not in the retrieved processes.");
		} else {
			total += processRetrieveMetric(allProcesses, compoProcess, metric) * compo.amount;
		}
	}
	return total + process.metrics[metric];
}
function deleteProcess(processId) {
	console.warn("deleteProcess", processId);
	fetch(`/delete_process/${processId}`, {
		method: 'POST'
	})
	.then(response => response.json())
	.then(data => {
		if (data.success) {
			fetchProcesses();
		} else {
			console.error('Error deleting process:', data.error);
		}
	})
	.catch(error => console.error('Error deleting process:', error));
}