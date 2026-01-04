import requests
import json
import time

url = 'https://leetcode.com/graphql/'
headers = {
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
}

query = """
    query problemsetPanelQuestionList($filters: QuestionFilterInput, $searchKeyword: String, $sortBy: QuestionSortByInput, $categorySlug: String, $limit: Int, $skip: Int) {
  problemsetPanelQuestionList(
    filters: $filters
    searchKeyword: $searchKeyword
    sortBy: $sortBy
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
  ) {
    questions {
      id
      titleSlug
      questionFrontendId
      title
      difficulty
      topicTags {
        name
        slug
      }
    }
    totalLength
    hasMore
  }
}
"""

all_questions = []
limit = 500
skip = 0

while True:
    print(f"Fetching skip={skip}, limit={limit}...")
    variables = {
        "skip": skip,
        "limit": limit,
        "categorySlug": "",
        "filters": {
            "filterCombineType": "ALL",
            "statusFilter": {"questionStatuses": [], "operator": "IS"},
            "difficultyFilter": {"difficulties": [], "operator": "IS"},
            "languageFilter": {"languageSlugs": [], "operator": "IS"},
            "topicFilter": {"topicSlugs": [], "operator": "IS"},
            "acceptanceFilter": {},
            "frequencyFilter": {},
            "frontendIdFilter": {},
            "lastSubmittedFilter": {},
            "publishedFilter": {},
            "companyFilter": {"companySlugs": [], "operator": "IS"},
            "positionFilter": {"positionSlugs": [], "operator": "IS"},
            "contestPointFilter": {"contestPoints": [], "operator": "IS"},
            "premiumFilter": {"premiumStatus": [], "operator": "IS"}
        },
        "searchKeyword": "",
        "sortBy": {"sortField": "CUSTOM", "sortOrder": "ASCENDING"}
    }

    try:
        response = requests.post(url, headers=headers, json={'query': query, 'variables': variables})
        data = response.json()
        
        if 'errors' in data:
            print("Errors:", data['errors'])
            break

        questions = data['data']['problemsetPanelQuestionList']['questions']
        all_questions.extend(questions)
        
        has_more = data['data']['problemsetPanelQuestionList']['hasMore']
        print(f"Fetched {len(questions)} questions. Total so far: {len(all_questions)}")
        
        if not has_more:
            break
            
        skip += limit
        time.sleep(0.5) # Be nice to the API

    except Exception as e:
        print(f"Error: {e}")
        break

# Save to file
with open('leetcode_questions.json', 'w') as f:
    json.dump(all_questions, f, indent=2)

print("Done. Saved to leetcode_questions.json")
