# Serverless Twitter Bot

1. Get bot twitter mentions from the last tweet id processed. (DynamoDB)
2. Search for 'image?' string
3. Get the images from the tweet 
4. Use AWS Rekognition to get image Labels 
5. Teet Response with the labels 
6. Save the Tweet id to DynamoDB


## Offline

Plugins: 
 * serverless-offline 
 * serverless-dynamodb-local

```
npm run offline
```

Replace event scheduled to http --> TODO:  find a way to run Scheduled events locally

