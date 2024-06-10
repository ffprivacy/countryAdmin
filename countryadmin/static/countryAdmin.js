function getProcessById(processes, id) {
    return processes.find(process => process.id === id);
}
function processRetrieveMetric(allProcesses, process, sens, metric) {
	let total = 0;
	for (let compo of process.composition) {
		let compoProcess = getProcessById(allProcesses, compo.id);
		if (compoProcess === undefined) {
			console.warn("process with id " + compo.id + " is not in the retrieved processes.");
		} else {
			total += processRetrieveMetric(allProcesses, compoProcess, sens, metric) * compo.amount;
		}
	}
	return total + process.metrics[sens][metric];
}
function processNSubProcess(allProcesses, process) {
    let total = 0;
    for (let compo of process.composition) {
		let compoProcess = getProcessById(allProcesses, compo.id);
		if (compoProcess === undefined) {
			console.warn("process with id " + compo.id + " is not in the retrieved processes.");
		} else {
			total += 1;
		}
	}
	return total;
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
async function setProcess(process) {
    try {
        const response = await fetch('/set_process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(process)
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.success) {
            console.log('Process submitted successfully:', result);
            // Optionally, update the page with new data or display a success message
        } else {
            console.error('Error submitting process:', result.error);
        }
    } catch (error) {
        console.error('There was a problem with the process submission:', error.message);
    }
}
function addComment(processId, comment) {
    fetch(`/add_comment/${processId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comment: comment })
    }).then(response => response.json())
    .then(data => {
        if (data.success) {
            fetchProcesses();
        } else {
            console.error('Error adding comment:', data.error);
        }
    }).catch(error => console.error('Error adding comment:', error));
}

// 
function likeProcess(processId) {
    fetch(`/like_process/${processId}`, {
        method: 'POST'
    }).then(response => response.json())
    .then(data => {
        if (data.success) {
            fetchProcesses();
        } else {
            console.error('Error liking process:', data.error);
        }
    }).catch(error => console.error('Error liking process:', error));
}
function dislikeProcess(processId) {
    fetch(`/dislike_process/${processId}`, {
        method: 'POST'
    }).then(response => response.json())
    .then(data => {
        if (data.success) {
            fetchProcesses();
        } else {
            console.error('Error disliking process:', data.error);
        }
    }).catch(error => console.error('Error disliking process:', error));
}
function processMetricsGetList() {
    return [
        { id: 'social', label: 'Social', defaultValue: 10, icon: 'human.png', unit: '' },
        { id: 'economic', label: 'Economic', defaultValue: 10, icon: 'human.png', unit: '$' },
        { id: 'envEmissions', label: 'GES emissions in kgCO2eq', defaultValue: 10, icon: 'carbon.png', unit: 'kgCO2eq' },
        { id: 'human', label: 'Human', defaultValue: '', icon: 'human.png', unit: 'people' },
        { id: 'ground', label: 'Ground', defaultValue: '', icon: 'land.png', unit: 'km2' },
        { id: 'ores', label: 'Ores', defaultValue: '', icon: 'ore2.png', unit: 'tonnes' },
        { id: 'water', label: 'Water', defaultValue: '', icon: 'water_drop.png', unit: 'L' },
        { id: 'oil', label: 'Oil', defaultValue: '', icon: 'oil.png', unit: 'L' },
        { id: 'gas', label: 'Gas', defaultValue: '', icon: 'gas.png', unit: 'L' }
    ];
}
function processMetricsIdsGetList() {
    return processMetricsGetList().map(obj => obj.id);
}