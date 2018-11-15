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
  if (mentions && mentions.length > 0) {
    const tweet = mentions[0]; 
    if (tweet.entities.media.length > 0) {    
      const imgBytes = await getImageData(tweet.entities.media[0].media_url)
       //await call REK
       const params = {
        Image: {            
            Bytes: imgBytes
        },
        MaxLabels: 5,
        MinConfidence: 75,
      };
      console.log ("detectLabels");
      const data = await rekognition.detectLabels(params).promise().catch(err => console.log(err));
      
      if (data.Labels && data.Labels.length > 0) {
        console.log ("RESPOnsE TWEET");
        const tweeted = await tw.post('statuses/update', {
           status: '@' + tweet.user.screen_name + " " +  "I can see: " + data.Labels.map (label => label.Name).join(', '),
           in_reply_to_status_id: tweet.id_str}) 
        save(tweet.id_str);
      } 
    }
  } 
}