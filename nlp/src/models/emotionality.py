from nltk.sentiment.vader import SentimentIntensityAnalyzer
from nltk import tokenize


def classify(sentence):
    sentim_analyzer = SentimentIntensityAnalyzer()

    return sentim_analyzer.polarity_scores(sentence)