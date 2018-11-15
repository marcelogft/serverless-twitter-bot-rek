'use strict'; 
const fetch = require('node-fetch'); 
const Twitter = require('twitter');
const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies

const tw = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token_key: process.env.ACCESS_TOKEN_KEY,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

let options = {};
// connect to local DB if running offline
if (process.env.IS_OFFLINE) {
  options = {
    region: 'localhost',
    endpoint: 'http://localhost:8000',
  };
}
const client = new AWS.DynamoDB.DocumentClient(options);
const rekognition = new AWS.Rekognition();

const get = () => { 
  const params = {
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        id: 'last',
      },
    }; 
    return client.get(params).promise().then ((data) => data); 
}

const save = (id) => {
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Item: {
      id: 'last',
      data: id
    },
  }; 
  // write to the database
  return client.put(params).promise().then ((data) => data); 
}; 

const getImageData = async (url) => {
  try {
      const response = await fetch(url);
      const data = await response.buffer();
      return data;
  } catch (error) {
      console.log(error);
  }
};

module.exports.rek = async () => { 
  const lastId = await get();  
  if (!lastId.Item) {
    lastId.Item = {}
    lastId.Item.data = '1'
  }
  const mentions = await tw.get('statuses/mentions_timeline', {since_id: lastId.Item.data}).then(tweets => tweets.filter(item => item.text.indexOf('image?') > -1));
  await mentions.forEach(async (tweet) => { 
    if (tweet.entities.media.length > 0) {
      await tweet.entities.media.forEach(async (url) => { 
        let responseTweetText = "I can see: ";
        console.log(url.media_url);       
        const imgBytes = await getImageData(url.media_url)
         //await call REK
        const params = {
          Image: {            
              Bytes: imgBytes
          },
          MaxLabels: 5,
          MinConfidence: 75,
        };
       const rekResult = await rekognition.detectLabels(params).promise()
                              .then (data => data)
                              .catch (err => console.log(err)); 
       responseTweetText += rekResult.Labels.map (label => label.Name).join(', '); 
      })
    } else {
      console.log("No image!");
      responseTweetText = "Where is the image?"
    }
    // RESPOnsE TWEET 
    tw.post('statuses/update', {
      status: '@' + tweet.user.screen_name + " " + responseTweetText,
      in_reply_to_status_id: tweet.id_str
    }, (err, data, response) => {
      if (err) {
        console.log(err)
      } else {
        console.log(data.text + ' tweeted!')
        save(tweet.id_str);
      }
    })  
  });  
}