const https = require('https');
var zipcodes = require('zipcodes');
var app = require('http').createServer(response);
var fs = require('fs');
var io = require('socket.io')(app);

var postoptions = {
    hostname: '***',
    path: '/dev/lda-topic-inference',
    headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json',
        'x-api-key': '***'
    },
    method: 'POST'
};

winningIndex = [];
locationIdentitfied = false;
fs.readFile('newdata.json', 'utf8', function(err, data) {
    if (err) {
        return console.log(err);
    }
    objDump = JSON.parse(data);
    onReady();
});

locationsMap = {"Alabama":{}, "Alaska":{}, "Arizona":{}, "Arkansas":{}, "California":{}, "Colorado":{}, "Connecticut":{}, "Delaware":{}, "Dist. of Columbia":{}, "Florida":{}, "Georgia":{}, "Hawaii":{}, "Idaho":{}, "Illinois":{}, "Indiana":{}, "Iowa":{}, "Kansas":{}, "Kentucky":{}, "Louisiana":{}, "Maine":{}, "Maryland":{}, "Massachusetts":{}, "Michigan":{}, "Minnesota":{}, "Mississippi":{}, "Missouri":{}, "Montana":{}, "Nebraska":{}, "Nevada":{}, "New Hampshire":{}, "New Jersey":{}, "New Mexico":{}, "New York":{}, "North Carolina":{}, "North Dakota":{}, "Ohio":{}, "Oklahoma":{}, "Oregon":{}, "Pennsylvania":{}, "Rhode Island":{}, "South Carolina":{}, "South Dakota":{}, "Tennessee":{}, "Texas":{}, "Utah":{}, "Vermont":{}, "Virginia":{}, "Washington":{}, "West Virginia":{}, "Wisconsin":{}, "Wyoming":{}};
abbrevationMap = {AK: "Alaska",AL: "Alabama",AR: "Arkansas",AZ: "Arizona",CA: "California",CO: "Colorado",CT: "Connecticut",DC: "District of Columbia",DE: "Delaware",FL: "Florida",GA: "Georgia",HI: "Hawaii",IA: "Iowa",ID: "Idaho",IL: "Illinois",IN: "Indiana",KS: "Kansas",KY: "Kentucky",LA: "Louisiana",MA: "Massachusetts",MD: "Maryland",ME: "Maine",MI: "Michigan",MN: "Minnesota",MO: "Missouri",MS: "Mississippi",MT: "Montana",NC: "North Carolina",ND: "North Dakota",NE: "Nebraska",NH: "New Hampshire",NJ: "New Jersey",NM: "New Mexico",NV: "Nevada",NY: "New York",OH: "Ohio",OK: "Oklahoma",OR: "Oregon",PA: "Pennsylvania",RI: "Rhode Island",SC: "South Carolina",SD: "South Dakota",TN: "Tennessee",TX: "Texas",UT: "Utah",VA: "Virginia",VT: "Vermont",WA: "Washington",WI: "Wisconsin",WV: "West Virginia",WY: "Wyoming"};

var onReady = function() {
    var i = 0;
    objDump.forEach(function(obj) {
        console.log(i++ + ". " + obj["question"]);
    });
	console.log("App running...");
    app.listen(3001);
};

function response(req, res) {
    var file = "";
    if (req.url == "/") {
        file = __dirname + '/index.html';
    } else {
        file = __dirname + req.url;
    }
    fs.readFile(file, function(err, data) {
        if (err) {
            res.writeHead(404);
            return res.end('Page or file not found');
        }
        res.writeHead(200);
        res.end(data);
    });
}
io.on("connection", function(socket) {
    socket.on("send message", function(sent_msg, callback) {
        var reply = "[ " + getCurrentDate() + " ]: " + sent_msg;
        io.sockets.emit("update messages", reply);
        if (sent_msg == "hi") {
            io.sockets.emit("update messages", formatServerReply("hello from server"));
        } else {
            var question = sent_msg;
            console.log('Question: ' + question);
            findLocationTerm(question, find, io);
        }
        callback();
    });
});

function getCurrentDate() {
    var currentDate = new Date();
    var day = (currentDate.getDate() < 10 ? '0' : '') + currentDate.getDate();
    var month = ((currentDate.getMonth() + 1) < 10 ? '0' : '') + (currentDate.getMonth() + 1);
    var year = currentDate.getFullYear();
    var hour = (currentDate.getHours() < 10 ? '0' : '') + currentDate.getHours();
    var minute = (currentDate.getMinutes() < 10 ? '0' : '') + currentDate.getMinutes();
    var second = (currentDate.getSeconds() < 10 ? '0' : '') + currentDate.getSeconds();
    return year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second;
}

String.prototype.capitalizeTxt = String.prototype.capitalizeTxt || function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

var findLocationTerm = function(question, callback, io) {
	locationIdentitfied = false;
	string = question.replace(/[^a-zA-Z0-9]/g, " ");
	var words = string.split(" ");
	for (var i=0; i<words.length; i++) {
		var loc = words[i];
		if (isNumber(loc)) {
			var state = zipcodes.lookup(loc)['state'];
			loc = abbrevationMap[state];
		}
		loc = toTitleCase(loc);
		if (loc in locationsMap) {
			question.replace(loc, '');
			locationIdentitfied = loc;
			break;
		}
	};
	if (!locationIdentitfied)
		io.sockets.emit("update messages", formatServerReply("Please include a valid jurisidiction name in query"));
	else 
		callback(question, io, 0);
};

var find = function(question, io, number) {
    var data = '';
    var req = https.request(postoptions, function(res) {
        res.on('data', function(chunk) {
            data += chunk;
        });
        res.on('end', () => {
            data = JSON.parse(data);
            if (number == 20) {
                findMostRelevant({
                    "relevances": getAllTopicTerms(data.inferred_topics)
                }, io);
            } else {
                findMostRelevant({
                    "relevances": getAllTopicTerms(data.inferred_topics)
                }, null);
                find(question, io, number + 1);
            }

        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });

    var questionobj = {
        "input_text": question
    };
    req.write(JSON.stringify(questionobj));
    req.end();
}

var findMostRelevant = function(allRelevants, io) {
    var objscores = [];
    objDump.forEach(function(questionobj) {
        var objscore = 0;
        Object.keys(allRelevants['relevances']).forEach(function(term) {
            if (term in questionobj.relevances) {
                objscore += Math.pow((questionobj.relevances[term]['multiplier'] - allRelevants['relevances'][term]['multiplier']), 2);
            } else
                objscore += Math.pow(allRelevants['relevances'][term]['multiplier'], 2);
        });
        objscores.push(Math.sqrt(objscore));
    });
    winningIndex.push(objscores.indexOf(Math.min(...objscores)));
    if (io != null) {
    	console.log(locationIdentitfied);
        io.sockets.emit("update messages", formatServerReply(objDump[mode(winningIndex)]["jurisdiction"][locationIdentitfied]["ANSWER"]));
        winningIndex = [];
        locationIdentitfied = false;
    }
};

var formatServerReply = function(msg) {
    var reply = "[ " + getCurrentDate() + " ]: " + "<span style='color:red'><b>" + msg + "</b></span> ";
    return reply
}

var mode = function(numbers) {
    var modes = [],
        count = [],
        i, number, maxIndex = 0;
    for (i = 0; i < numbers.length; i += 1) {
        number = numbers[i];
        count[number] = (count[number] || 0) + 1;
        if (count[number] > maxIndex) {
            maxIndex = count[number];
        }
    }
    for (i in count)
        if (count.hasOwnProperty(i)) {
            if (count[i] === maxIndex) {
                modes.push(Number(i));
            }
        }
    return [modes[0]];
}

var getAllTopicTerms = function(topics) {
    var topicTermArray = {};
    topics.forEach(function(topic) {
        topic.topic_term_weights.forEach(function(topic_term_weight) {
            if (topic_term_weight['term'] in topicTermArray) {
                if (topic_term_weight['weight'] > topicTermArray[topic_term_weight['term']]['weight']) {
                    topicTermArray[topic_term_weight['term']] = {
                        'term': topic_term_weight['term'],
                        'weight': topic_term_weight['weight'],
                        'topic_id': topic['topic_id'],
                        'topic_probability': topic['topic_probability'],
                        'multiplier' : topic_term_weight['weight']// * topic['topic_probability']
                    }
                }
            } else {
                topicTermArray[topic_term_weight['term']] = {
                    'term': topic_term_weight['term'],
                    'weight': topic_term_weight['weight'],
                    'topic_id': topic['topic_id'],
                    'topic_probability': topic['topic_probability'],
                    'multiplier' : topic_term_weight['weight']// * topic['topic_probability']
                }
            }
        });
    });
    return topicTermArray;
};