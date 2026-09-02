const image = (src) => ({ type: "image", src });
const video = (src) => ({ type: "video", src });

const aslAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((word) => ({
  id: `asl-letter-${word.toLowerCase()}`,
  word,
  translation: `Letter ${word}`,
  category: "Alphabet",
  aliases: ["fingerspelling", "letter", `letter ${word}`],
  media: [image(`/images/asl/${word.toLowerCase()}.${["J", "Z"].includes(word) ? "gif" : "png"}`)]
}));

const aslWords = [
  { id: "asl-about", word: "About", category: "Common words", aliases: ["regarding", "concerning"], media: [video("/videos/asl/about.webm")] },
  { id: "asl-book", word: "Book", category: "Common words", aliases: ["books", "read"], media: [video("/videos/asl/book.webm")] },
  { id: "asl-hello", word: "Hello", category: "Greetings", aliases: ["hi", "greeting"], media: [video("/videos/asl/hello.webm")] }
];

const cslWords = [
  { word: "កម្ពុជា", media: [image("/images/csl/កម្ពុជា.gif")] },
  { word: "ត្រូវ", media: [image("/images/csl/ត្រូវ.gif")] },
  { word: "ឆ្ងាញ់", media: [image("/images/csl/ឆ្ងាញ់.gif")] },
  { word: "អរគុណ", media: [image("/images/csl/អរគុណ.gif")] },
  { word: "ខុស", media: [image("/images/csl/ខុស.gif")] },
  { word: "មនុស្សថ្លង់", media: [image("/images/csl/reference/form_aa.jpg")] },
  { word: "មនុស្សស្តាប់លឺ", media: [image("/images/csl/reference/form_ab.jpg")] },
  { word: "ផឹកទឹក", media: [image("/images/csl/reference/form_ac.jpg")] },
  { word: "សុំធ្វើម្តងទៀត", media: [image("/images/csl/reference/form_u.jpg")] },
  { word: "ត្រឹមត្រូវ", media: [image("/images/csl/reference/form_v.jpg")] },
  { word: "ចងចាំ", media: [image("/images/csl/reference/form_x.jpg")] }
].map((entry, index) => ({
  id: `csl-${index + 1}`,
  category: "CSL",
  aliases: [],
  ...entry
}));

export const signDictionary = {
  asl: [...aslAlphabet, ...aslWords],
  csl: cslWords
};
