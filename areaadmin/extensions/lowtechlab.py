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
    print(f"tutorial list at {url}")
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
                    'url': tutorial_url,
                    'cost': details['cost'], 'duration': details['duration']
                })
        
        next_page = soup.find('a', string='Load more')
        if next_page:
            url = 'https://wiki.lowtechlab.org' + next_page['href']
        else:
            break

    return tutorials

AREA_ADMIN_OBJECT_ECONOMIC = 2

def extension_get_processes(*args):

    processes = []
    page_max = 1

    if 0 < len(args):
        page_max = int(args[0])

    for page in range(1,page_max+1):
        explore_url = f'https://wiki.lowtechlab.org/wiki/Explore?page={page}'
        tutorials_list = fetch_tutorials(explore_url)

        for tutorial in tutorials_list:
            processes.append(
                {
                'title': tutorial['title'],
                'description': tutorial['description'] + "<a href=\"" + tutorial['url'] + "\" target=\"_blank\">link</a>",
                'metrics': {
                    'input': {
                        AREA_ADMIN_OBJECT_ECONOMIC: tutorial['cost']
                    },
                    'output': {}
                },
                'tags': []
            })
    return processes

def extension_display_help():
    print("args: [page no max]")
