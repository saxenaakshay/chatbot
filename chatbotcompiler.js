const fs = require('fs');
const https = require('https');
var allAnswers = [];

var postoptions = {
    hostname: '****',
    path: '/dev/lda-topic-inference',
    headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json',
        'x-api-key': '***'
    },
    method: 'POST'
};

var formQuestion = function(subquestion, mainQuestion) {
    if (subquestion == "Short Answer")
        return (mainQuestion.split('?')[0] + " in few words");
    else
        return (subquestion + " for " + mainQuestion);
}

var generateAnswers = function(allQuestions) {
    var questionsToQuery = [];
    allQuestions.forEach(function(question) {
        var mainQuestion = question["QUESTION"];
        question["SUB-QUESTIONS"].forEach(function(subquestion) {
            var qq = formQuestion(subquestion["EACH-SUB-QUESTION"], mainQuestion)
            questionsToQuery.push({
                'q' : qq,
                'j' : subquestion['JURISDICTIONS']
            });
        });
    });
    callNext(questionsToQuery, 0)       
}

var callNext = function(questionsToQuery, number) {
    if (number < questionsToQuery.length)
        postData(questionsToQuery, number) ;  
    else 
        console.log(JSON.stringify(allAnswers));
};


var getAllTopicTerms = function(topics) {
    var topicTermArray = {};
    topics.forEach(function(topic) {
        topic.topic_term_weights.forEach(function(topic_term_weight) {
            if (topic_term_weight['term'] in topicTermArray) {
                if (topic_term_weight['weight'] > topicTermArray[topic_term_weight['term']]['weight']) {
                    topicTermArray[topic_term_weight['term']] = {
                        'term' : topic_term_weight['term'],
                        'weight' : topic_term_weight['weight'],
                        'topic_id' : topic['topic_id'],
                        'topic_probability' : topic['topic_probability'],
                        'multiplier' : topic_term_weight['weight']// * topic['topic_probability']
                    }
                }
            } else {
                topicTermArray[topic_term_weight['term']] = {
                    'term' : topic_term_weight['term'],
                    'weight' : topic_term_weight['weight'],
                    'topic_id' : topic['topic_id'],
                    'topic_probability' : topic['topic_probability'],
                    'multiplier' : topic_term_weight['weight']// * topic['topic_probability']
                }
            }
        });
    });
    return topicTermArray;
};

var getAllLocationTerms = function(jurisdictions) {
    var jurisdictionsArray = {};
    jurisdictions.forEach(function(jurisdiction) {
        jurisdictionsArray[jurisdiction['JURISDICTION']] = jurisdiction
    });
    return jurisdictionsArray;
}

var storeRelevances = function(question, data) {
    var answer = {
        "question" : question['q'],
        "relevances": getAllTopicTerms(data.inferred_topics),
        "jurisdiction" : getAllLocationTerms(question['j'])
    };
    allAnswers.push(answer);
};

var postData = function(questionToQuery, number, callback) {
    var data = '';
    var req = https.request(postoptions, function(res) {
        res.on('data', function(chunk) {
            data += chunk;
        });
        res.on('end', () => {
            storeRelevances(questionToQuery[number], JSON.parse(data));
            callNext(questionToQuery, number+1);
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });

    var questionobj = {
        "input_text": questionToQuery[number]['q']
    };
    req.write(JSON.stringify(questionobj));
    req.end();
}

var organize = function(output) {
    console.log(output)
}

fs.readFile('sample.json', 'utf8', function(err, data) {
    if (err) {
        return console.log(err);
    }
    generateAnswers(JSON.parse(data));
});