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

    static area_metrics_list = []
    static async fetchMetricsGetList() {
        Processes.area_metrics_list = await fetch(`/api/processes/metrics`).then(response => response.json());
        return new Promise((resolve, reject) => {
            try {
                const iconMapping = {
                    social: 'human.png',
                    economic: 'economic.png',
                    envEmissions: 'carbon.png',
                    human: 'human.png',
                    ground: 'land.png',
                    ores: 'ore2.png',
                    water: 'water_drop.png',
                    oil: 'oil.png',
                    gas: 'gas.png',
                    pm25: 'smoke.png'
                };
    
                Processes.area_metrics_list = Processes.area_metrics_list.map(item => {
                    return {
                        ...item,
                        icon: iconMapping[item.id] || 'default_icon.png'
                    };
                });
    
                resolve(Processes.area_metrics_list);
            } catch (error) {
                reject(error);
            }
        });
    }
    static metricsGetList() {
        return Processes.area_metrics_list;
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

    static async delete(process_id) {
        try {
            const response = await fetch(`/api/process/${process_id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                dashboardRefresh();
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
            const response = await fetch(`/api/area/${AREA_DATA['area_id']}/set_process`, {
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

    static async addComment(process_id, comment) {
        try {
            const response = await fetch(`/api/area/${AREA_DATA['area_id']}/process/${process_id}/add_comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: comment })
            });
            const data = await response.json();
            if (data.success) {
                dashboardRefresh();
                console.log('Comment added successfully.');
            } else {
                console.error('Error adding comment:', data.error);
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    }
    static dislike(process_id) {
        fetch(`/api/area/${AREA_DATA['area_id']}/process/${process_id}/dislike`, {
            method: 'POST'
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                dashboardRefresh();
            } else {
                console.error('Error disliking process:', data.error);
            }
        });
    }

    static like(process_id) {
            fetch(`/api/area/${AREA_DATA['area_id']}/process/${process_id}/like`, {
                method: 'POST'
            }).then(response => response.json())
            .then(data => {
                if (data.success) {
                    dashboardRefresh();
                } else {
                    console.error('Error liking process:', data.error);
                }
            }).catch(error => console.error('Error liking process:', error));
    }

    static compositionUpdate(process_id, composition) {
        fetch(`/api/process/${process_id}/update_composition`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(composition)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                dashboardRefresh();
            } else {
                console.error('Error updating composition:', data.error);
            }
        })
        .catch(error => console.error('Error updating composition:', error));
    }
    
    static compositionDelete(process_id, compositionId) {
        fetch(`/api/process/${process_id}/delete_composition/${compositionId}`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                dashboardRefresh();
            } else {
                console.error('Error deleting composition:', data.error);
            }
        })
        .catch(error => console.error('Error deleting composition:', error));
    }

}