import streamDeck from '@elgato/streamdeck';
import { AITextAction, PromptSelectorAction } from './plugin';

const logMain = (msg: string) => {
  streamDeck.logger.info(msg);
};

logMain('Registering actions...');
streamDeck.actions.registerAction(new AITextAction());
streamDeck.actions.registerAction(new PromptSelectorAction());

logMain('Connecting...');
streamDeck.connect().then(() => {
  logMain('Connected successfully');
}).catch((e: any) => {
  logMain(`Connection failed: ${e.message}`);
});
