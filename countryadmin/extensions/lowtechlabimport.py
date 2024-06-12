import requests
from bs4 import BeautifulSoup

def extractMetric(soup, metric="money"):
    # Find the element using a CSS selector and navigate two levels up in the DOM
    value_container = soup.select_one(".tuto-details-box .fa-money")
    if value_container:
        grandparent = value_container.parent.parent
        
        # Now find the desired data container using another CSS selector
        target = grandparent.select_one(".tuto-items-details-container-right")
        if target:
            # Extract the numeric part, assuming it is prefixed with the currency and space
            value_text = target.text.strip()
            number_part = value_text.split(" ")[0].replace(',', '.')
            try:
                # Convert the extracted number part to float
                return float(number_part)
            except ValueError:
                # Handle cases where conversion to float fails
                return None
    return None

def fetchDetails(url):
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')    
    return {'cost': extractMetric(soup, "money"), 'duration': extractMetric(soup, "clock")}

def fetch_tutorials(url):
    tutorials = []
    while True:
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        tutorial_links = soup.select('.searchresults a[href*="/wiki/"]')

        for link in tutorial_links:
            title = link.text.strip()
            title = title.split("\n")[0]
            href = link.get('href')
            if href and title:
                tutorial_url = f'https://wiki.lowtechlab.org{href}'
                details = fetchDetails(tutorial_url)
                tutorials.append({'title': title, 'url': tutorial_url, 'cost': details['cost'], 'duration': details['duration']})
        
        next_page = soup.find('a', text='Load more')
        if next_page:
            url = 'https://wiki.lowtechlab.org' + next_page['href']
        else:
            break

    return tutorials

# URL to the Explore page
explore_url = 'https://wiki.lowtechlab.org/wiki/Explore?page=1'
tutorials_list = fetch_tutorials(explore_url)
print(tutorials_list)
