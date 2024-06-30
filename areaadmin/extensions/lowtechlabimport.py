import requests
from bs4 import BeautifulSoup

def extractMetric(soup, metric="money"):
    value_container = soup.select_one(f".tuto-details-box .fa-{metric}")
    if value_container:
        grandparent = value_container.parent.parent
        
        target = grandparent.select_one(".tuto-items-details-container-right")
        if target:
            value_text = target.text.strip()
            number_part = value_text.split(" ")[0].replace(',', '.')
            try:
                return float(number_part)
            except ValueError:
                return None
    return None

def fetchDetails(url):
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')    
    description = soup.select_one(".tuto-details-about-title").text.strip()
    return {'cost': extractMetric(soup, "money"), 'duration': extractMetric(soup, "clock-o"), "description": description}

def fetch_tutorials(url):
    tutorials = []
    while True:
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        tutorial_links = soup.select('.searchresults a[href*="/wiki/"]')

        print(f"Found {len(tutorial_links)} processes")
        for link in tutorial_links:
            title = link.text.strip()
            title = title.split("\n")[0]
            href = link.get('href')
            print(f"Fetching {href}")
            if href and title:
                tutorial_url = f'https://wiki.lowtechlab.org{href}'
                details = fetchDetails(tutorial_url)
                tutorials.append({
                    'title': title, 'url': tutorial_url, 
                    'description': details['description'],
                    'cost': details['cost'], 'duration': details['duration']
                })
        
        next_page = soup.find('a', string='Load more')
        if next_page:
            url = 'https://wiki.lowtechlab.org' + next_page['href']
        else:
            break

    return tutorials

def post_tutorial_to_endpoint(tutorial):
    endpoint_url = 'http://127.0.0.1:5000/api/set_process'
    headers = {'Content-Type': 'application/json'}
    
    data = {
        'title': tutorial['title'],
        'description': tutorial['description'],
        'metrics': {
            'input': {
                'economic': tutorial['cost']
            },
            'output': {}
        },
        'tags': []
    }
    
    response = requests.post(endpoint_url, json=data, headers=headers)
    if response.status_code == 200:
        print("Successfully posted:", tutorial['title'])
    else:
        print("Failed to post:", tutorial['title'], response.text)

explore_url = 'https://wiki.lowtechlab.org/wiki/Explore?page=1'
tutorials_list = fetch_tutorials(explore_url)

for tutorial in tutorials_list:
    post_tutorial_to_endpoint(tutorial)
post_tutorial_to_endpoint(tutorials_list[0])