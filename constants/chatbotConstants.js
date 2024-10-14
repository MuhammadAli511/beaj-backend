import waConstantsRepository from "../repositories/waConstantsRepository.js";

const introLists = [
    "hello",
    "hi",
    "hey",
    "hello there",
    "hi there",
    "hey there",
]

const personaDict = {
    '1': 'teacher',
    '2': 'student',
    '3': 'office employee',
    '4': 'parent'
}

const mcqsResponse = {
    "1214": "See correct answers below:\n\n1. ✅ Sana calls Irum.\n2. ✅ The party is at Sana's house.\n3. ✅ Irum will reach the party after 6: 30 p.m.\n4. ✅ Irum will bring drinks to the party.\n5. ✅ Sana's house is number 64.\n6. ✅ Sana's house is opposite an empty plot.\n7. ✅ Sana's house is on street 7.\n\nKeep working hard!",
    "1220": "See correct answers below:\n\n1. ✅ 'Could' means: کر سکتے  \n2. ✅ 'Something' means: کچھ  \n3. ✅ 'Continue' means: جاری رکھنا  \n4. ✅ Sara is hosting a birthday party for her sister.\n5. ✅ They will go to the bank in the afternoon.\n6. ✅ Can you please confirm your address? \n7. ✅ There is a mosque opposite my house.\n\nKeep working hard!",
    "1226": "See correct answers below:\n\n1. ✅ Which sentence is in the future tense? I will do my homework.\n2. ✅ Which sentence is in the future tense The boys will play cricket in the park.\n3. ✅ Which sentence is correct? She will not visit her friends.\n4. ✅ Which sentence is correct? Bilal and Sana will not bake a cake.\n5. ✅ She goes to sleep at 10 o'clock.\n6. ✅ Sana was born in 2002.\n7. ✅ We will have a meeting on Tuesday.\n8. ✅ Badshahi Masjid is in Lahore.\n9. ✅ Sana's house is at the end of the street.\n\nKeep working hard!",
    "1228": "See correct answers below:\n\n1. ✅ 'What's up?': Not much, just busy with work.\n2. ✅ 'What do you do on weekends?': I play cricket with my friends.\n3. ✅ 'Does she like films?': She doesn't like films.\n4. ✅ 'Hello! Could I speak to Bilal, please?': Yes, Bilal speaking.\n5. ✅ 'What are you going to do?': I am going to eat lunch.\n6. ✅ Choose the correct verb: In cricket, fielders catch the ball.\n7. ✅ She needs a kilogram of rice.\n8. ✅ We live in Karachi.\n9. ✅ I like apples and I like bananas.\n10. ✅ 8:15 is the same as: quarter past 8\n11. ✅ She is an excellent student; she always does her work on time.\n12. ✅ Mental health is also called: wellbeing\n\nKeep working hard!",
    "1232": "See correct answers below:\n\n1. ✅ 'Impression' means: تاثر\n2. ✅ 'Professional' means: پیشہ ور\n3. ✅ Miss Saniha greets her students pleasantly every morning.\n4. ✅ We should stay alert during meetings.\n5. ✅ People often form the first impression of you within seconds.\n6. ✅ Anum is meeting Farah for the first time. She should make eye contact.\n7. ✅ Ali's father has a lot of meetings at his office today. He should leave early for office.\n8. ✅ Which is not right to do in a workplace: going to sleep\n\nKeep working hard!",
}

export { introLists, personaDict, mcqsResponse };