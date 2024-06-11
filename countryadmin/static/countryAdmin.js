class Processes {

    static getById(processes, id) {
        return processes.find(process => process.id === id);
    }

    static retrieveMetric(allProcesses, process, sens, metric) {
        let total = 0;
        for (let compo of process.composition) {
            let compoProcess = Processes.getById(allProcesses, compo.id);
            if (compoProcess) {
                const metric2 = Processes.retrieveMetric(allProcesses, compoProcess, sens, metric);
                total += metric2 * compo.amount;
            } else {
                console.warn(`process with id ${compo.id} is not in the retrieved processes.`);
            }
        }
        return total + process.metrics[sens][metric];
    }

    static metricsGetList() {
        return [
            { id: 'social', label: 'Social', icon: 'human.png', unit: '' },
            { id: 'economic', label: 'Economic', icon: 'economic.png', unit: '$' },
            { id: 'envEmissions', label: 'GES emissions in kgCO2eq', icon: 'carbon.png', unit: 'kgCO2eq' },
            { id: 'human', label: 'Human', icon: 'human.png', unit: 'people' },
            { id: 'ground', label: 'Ground', icon: 'land.png', unit: 'km2' },
            { id: 'ores', label: 'Ores', icon: 'ore2.png', unit: 'tonnes' },
            { id: 'water', label: 'Water', icon: 'water_drop.png', unit: 'L' },
            { id: 'oil', label: 'Oil', icon: 'oil.png', unit: 'L' },
            { id: 'gas', label: 'Gas', icon: 'gas.png', unit: 'L' },
            { id: 'pm25', label: 'PM2.5', icon: 'smoke.png', unit: 'µg/m3' }
        ];
    }
    static metricsGetIdsList() {
        return Processes.metricsGetList().map(obj => obj.id);
    }

    static countSubProcesses(allProcesses, process) {
        let total = 0;
        for (let compo of process.composition) {
            let compoProcess = Processes.getById(allProcesses, compo.id);
            if (compoProcess) {
                total += 1;
            } else {
                console.warn(`process with id ${compo.id} is not in the retrieved processes.`);
            }
        }
        return total;
    }

    static async delete(processId) {
        try {
            const response = await fetch(`/delete_process/${processId}`, { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                fetchProcesses();
                console.log('Process deleted successfully.');
            } else {
                console.error('Error deleting process:', data.error);
            }
        } catch (error) {
            console.error('Error deleting process:', error);
        }
    }

    static async set(process) {
        try {
            const response = await fetch('/set_process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(process)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.statusText}`);
            }
            if (data.success) {
                console.log('Process submitted successfully:', data);
            } else {
                console.error('Error submitting process:', data.error);
            }
        } catch (error) {
            console.error('There was a problem with the process submission:', error);
        }
    }

    static async addComment(processId, comment) {
        try {
            const response = await fetch(`/add_comment/${processId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: comment })
            });
            const data = await response.json();
            if (data.success) {
                fetchProcesses();
                console.log('Comment added successfully.');
            } else {
                console.error('Error adding comment:', data.error);
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    }
    static dislike(processId) {
        fetch(`/dislike_process/${processId}`, {
            method: 'POST'
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                fetchProcesses();
            } else {
                console.error('Error disliking process:', data.error);
            }
        });
    }

    static like(processId) {
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

    static compositionUpdate(processId, composition) {
        fetch(`/update_composition/${processId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(composition)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                fetchProcesses();
            } else {
                console.error('Error updating composition:', data.error);
            }
        })
        .catch(error => console.error('Error updating composition:', error));
    }
    
    static compositionDelete(processId, compositionId) {
        fetch(`/delete_composition/${processId}/${compositionId}`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                fetchProcesses();
            } else {
                console.error('Error deleting composition:', data.error);
            }
        })
        .catch(error => console.error('Error deleting composition:', error));
    }

}