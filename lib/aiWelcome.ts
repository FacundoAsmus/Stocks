const WELCOME_MESSAGES = [
  "Hey! I'm Warrent, your friendly market guide. What numbers are we breaking down today?",
  "What's up! Warrent here, ready to help you dig into this stock. Where should we start?",
  "Hey there! I'm Warrent, and I'm here to help you make sense of all these financial stats. What are you curious about?",
  "Hey! Warrent here. Think of me as your stock-analyst buddy. What metric do you want to look at first?",
  "Hi! I'm Warrent, and I'm here to lend a hand with the data. What stock insights can I fetch for you today?",
  "Hey there! Warrent here, ready to help you untangle the market numbers. What do you want to check out?",
  "What's going on! I'm Warrent—here to help you keep a close eye on this stock. What's on your mind?",
  "Hey! I'm Warrent, and I've got all the latest stats right here to help you out. Which metric are we diving into?",
  "Hi friend! I'm Warrent, and I'm here to make tracking this stock super easy. What do you want to compare first?",
  "Hey! Warrent here, ready to help you cut through the noise and look at the real figures. What can I check for you?",
];

export function getRandomAIWelcome() {
  return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
}
