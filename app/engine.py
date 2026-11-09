import os
from pathlib import Path

import yaml
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

INTENTS_PATH = Path(os.getenv("INTENTS_PATH", Path(__file__).parent.parent / "intents.yaml"))
T_HIGH = float(os.getenv("T_HIGH", "0.5"))
T_LOW = float(os.getenv("T_LOW", "0.28"))
CRITICAL_FACTOR = 0.8
FALLBACK_TEXT = "Не нашёл подходящего ответа. Напишите нам на info@rayfund.ru, и сотрудники фонда ответят."
SUGGEST_TEXT = "Возможно, вы имели в виду:"


class Engine:
    def __init__(self, path=INTENTS_PATH):
        data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
        self.intents = {item["id"]: item for item in data["intents"]}
        self.phrases = []
        self.owners = []
        for intent_id, item in self.intents.items():
            for phrase in item["paraphrases"]:
                self.phrases.append(phrase.lower())
                self.owners.append(intent_id)
        self.vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)
        self.matrix = self.vectorizer.fit_transform(self.phrases)

    def label(self, intent_id):
        return self.intents[intent_id]["paraphrases"][0].capitalize()

    def ranked(self, text):
        sims = cosine_similarity(self.vectorizer.transform([text.lower()]), self.matrix)[0]
        best = {}
        for owner, score in zip(self.owners, sims):
            if score > best.get(owner, 0.0):
                best[owner] = float(score)
        return sorted(best.items(), key=lambda pair: pair[1], reverse=True)

    def render(self, intent_id):
        item = self.intents[intent_id]
        answer = (item.get("answer") or "TODO").strip()
        if answer.startswith("TODO"):
            answer = f"[Ответ для темы «{intent_id}» ещё не заполнен]"
        return {
            "reply": answer,
            "url": item.get("url"),
            "escalate": bool(item.get("escalate")),
        }

    def respond(self, text):
        ranked = self.ranked(text)
        top_id, top_score = ranked[0]
        critical = self.intents[top_id].get("priority") == "critical"
        high = T_HIGH * CRITICAL_FACTOR if critical else T_HIGH
        if top_score >= high:
            return {"status": "answer", "intent": top_id, "score": top_score, "suggestions": [], **self.render(top_id)}
        if top_score >= T_LOW:
            suggestions = [{"id": i, "title": self.label(i)} for i, s in ranked[:3] if s >= T_LOW * 0.6]
            return {
                "status": "suggest",
                "intent": top_id,
                "score": top_score,
                "reply": SUGGEST_TEXT,
                "url": None,
                "escalate": False,
                "suggestions": suggestions,
            }
        return {
            "status": "fallback",
            "intent": None,
            "score": top_score,
            "reply": FALLBACK_TEXT,
            "url": None,
            "escalate": True,
            "suggestions": [],
        }
