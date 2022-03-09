import fs from 'fs'
import csvParse from 'csv-parse'
import readline from 'readline'
import { google } from 'googleapis'
import { DateTime } from 'luxon'

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
export const initMatcher = async (emails) => {
  const params = {
    emails,
  };

  fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Gmail API.
    authorize(JSON.parse(content), (auth) => generateMatches(auth, params));
  });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

const shuf = (arr) => {
  for (let i=0; i<arr.length; i++) {
    const rand = Math.floor(Math.random() * (arr.length - i) + i);
    const temp = arr[i];    
    arr[i] = arr[rand];
    arr[rand] = temp;
  }
  return arr;
}

const hasMetMap = {}
const initHasMetMap = (emails) => {
  emails.forEach((email) => {
    hasMetMap[email] = [];
  })
}

/**
 * Only works for even numbers of emails
 *
 * @method recursivelyGetMatches
 * @return {Array}
 */
const getMatches = (shuffled) => {
  const shuffleOne = shuffled.slice(0, shuffled.length / 2)
  const shuffleTwo = shuffled.slice(shuffled.length / 2, shuffled.length)
  let validMatches = true;

  shuffleOne.forEach((email, idx) => {
    const isSelf = email === shuffleTwo[idx];

    if (isSelf) {
      validMatches = false
    }
  })

  return validMatches ? [ shuffleOne, shuffleTwo ] : getMatches(shuffled);
}

const logMatch = (listOne, listTwo) => {
  listOne.forEach((email, idx) => {
    if (!hasMetMap[email].includes(listTwo[idx])) {
      hasMetMap[email].push(listTwo[idx])
      hasMetMap[listTwo[idx]].push(email)
    }
  });
}

async function generateMatches(auth, params) {
  const { emails } = params
  initHasMetMap(emails)
  const shuffled = shuf(emails.slice());
  recursiveShuffle(shuffled)
  console.log(hasMetMap);
}

const recursiveShuffle = (list) => {
  if (list.length === 0) {
    return []
  }

  const [ subOne, subTwo ] = getMatches(list);
  logMatch(subOne, subTwo);
  rotateMatch(subOne, subTwo);
}

const rotateMatch = (shuffleOne, shuffleTwo) => {
  if (shuffleOne.length === 0 || shuffleTwo.length === 0) {
    return
  }
  const listOne = shuffleOne.slice();
  const listTwo = shuffleTwo.slice();

  for (let i=0; i < listTwo.length; i++) {
    listTwo.push(listTwo.shift());
    logMatch(listOne, listTwo);
  }
  rotateMatch(listOne.slice(0, listOne.length / 2), listOne.slice(listOne.length / 2, listOne.length))
  rotateMatch(listTwo.slice(0, listTwo.length / 2), listTwo.slice(listTwo.length / 2, listTwo.length))
}

const processCsv = (input) => {
  return input.map((input) => input[0] )
}

/**
 *  read csv file
 *  export to array of arrays
 *
 *  @param {String} input file
 *  @return {Array}
 */
export const readCSV = (inputPath) => {
  fs.readFile(inputPath, function (err, fileData) {
    csvParse(fileData, {columns: false, trim: true}, function(err, rows, idx) {
      const results = processCsv(rows.splice(1))
      initMatcher(results);
    })
  })
}

const FILENAME = process.env.INPUT_FILE || 'input.csv'
readCSV(FILENAME)
