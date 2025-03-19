import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "./ui/card";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";

interface TwitterAuthTokens {
  bearerToken: string;
  csrfToken: string;
}

interface TwitterUser {
  name: string;
  screen_name: string;
  profile_image_url_https: string;
}

const fetchAuthTokens = (): Promise<TwitterAuthTokens | null> => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_AUTH_TOKENS" }, (response) => {
      resolve(response?.tokens || null);
    });
  });
};

const fetchUserData = async (
  screen_name: string
): Promise<TwitterUser | null> => {
  const tokens = await fetchAuthTokens();
  if (!tokens?.bearerToken || !tokens?.csrfToken) return null;

  const url = `https://x.com/i/api/graphql/32pL5BWe9WKeSK1MoPvFQQ/UserByScreenName?variables=%7B%22screen_name%22%3A%22${screen_name}%22%7D`;
  try {
    const response = await fetch(url, {
      headers: {
        authorization: tokens.bearerToken,
        "x-csrf-token": tokens.csrfToken,
        "content-type": "application/json",
      },
    });
    const data = await response.json();
    const userData = data.data?.user?.result?.legacy;
    return userData || null;
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
};

interface PersonaData {
  communicationStyle: {
    formality: "formal" | "casual";
    verbosity: "verbose" | "concise";
    tone: "serious" | "humorous";
  };
  languagePatterns: {
    favoriteExpressions: string[];
    sentenceLength: "short" | "medium" | "long";
    vocabulary: "simple" | "complex";
    useOfJargon: boolean;
  };
  contentPreferences: {
    topics: string[];
    emotionalTone: "optimistic" | "neutral" | "cynical";
  };
  personalityTraits: {
    traits: string[];
    values: string[];
  };
  engagementStyle: {
    responseStyle: "supportive" | "challenging" | "questioning";
    interactionPreference: string[];
  };
}

const WelcomeStep = ({ onNext }: { onNext: () => void }) => {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<TwitterUser | null>(null);

  useEffect(() => {
    // Get user profile data from chrome storage
    chrome.storage.local.get(["main_screen_name"], async (result) => {
      if (result.main_screen_name) {
        const userData = await fetchUserData(result.main_screen_name);
        if (userData) {
          setUserProfile(userData);
        }
      }
    });

    const timer = setTimeout(() => {
      setShowWelcome(false);
      setShowProfile(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {showWelcome && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h1 className="text-5xl font-bold text-white mb-4">
              Welcome to Twitter Manager
            </h1>
            <p className="text-gray-300 text-xl">
              Let's get you set up for success
            </p>
          </motion.div>
        )}
        {showProfile && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-lg">
              <CardHeader className="text-center">
                {userProfile?.profile_image_url_https && (
                  <motion.img
                    src={userProfile.profile_image_url_https}
                    alt="Profile"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="w-24 h-24 rounded-full mx-auto border-4 border-white mb-4"
                  />
                )}
                <CardTitle className="text-3xl text-white">
                  {userProfile?.name || "Welcome"}
                </CardTitle>
                {userProfile?.screen_name && (
                  <CardDescription className="text-gray-300">
                    @{userProfile.screen_name}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xl text-center text-gray-200 mb-6">
                  Let's create your Twitter engagement persona
                </p>
              </CardContent>
              <CardFooter className="justify-center">
                <Button
                  onClick={onNext}
                  size="lg"
                  className="bg-white text-gray-900 hover:bg-gray-100"
                >
                  Create My Persona
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ContentPreferencesStep = ({
  data,
  onUpdate,
  onNext,
  onBack,
}: {
  data: PersonaData["contentPreferences"];
  onUpdate: (data: PersonaData["contentPreferences"]) => void;
  onNext: () => void;
  onBack: () => void;
}) => {
  const topics = [
    "Technology",
    "Business",
    "Politics",
    "Entertainment",
    "Sports",
    "Science",
    "Health",
    "Education",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="bg-white p-8 rounded-lg max-w-2xl w-full"
    >
      <h2 className="text-2xl font-bold text-black mb-6">
        Content Preferences
      </h2>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Select Your Topics of Interest
          </label>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => {
                  const newTopics = data.topics.includes(topic)
                    ? data.topics.filter((t) => t !== topic)
                    : [...data.topics, topic];
                  onUpdate({ ...data, topics: newTopics });
                }}
                className={`px-4 py-2 rounded-full ${
                  data.topics.includes(topic)
                    ? "bg-black text-white"
                    : "bg-gray-200 text-black"
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Emotional Tone
          </label>
          <div className="flex space-x-4">
            {["optimistic", "neutral", "cynical"].map((tone) => (
              <button
                key={tone}
                onClick={() =>
                  onUpdate({ ...data, emotionalTone: tone as any })
                }
                className={`px-4 py-2 rounded-full ${
                  data.emotionalTone === tone
                    ? "bg-black text-white"
                    : "bg-gray-200 text-black"
                }`}
              >
                {tone.charAt(0).toUpperCase() + tone.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex space-x-4 mt-8">
          <motion.button
            onClick={onBack}
            className="w-1/2 px-6 py-3 text-lg font-semibold text-black bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Back
          </motion.button>
          <motion.button
            onClick={onNext}
            className="w-1/2 px-6 py-3 text-lg font-semibold text-white bg-black rounded-full hover:bg-gray-900 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Next
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

const PersonalityTraitsStep = ({
  data,
  onUpdate,
  onNext,
  onBack,
}: {
  data: PersonaData["personalityTraits"];
  onUpdate: (data: PersonaData["personalityTraits"]) => void;
  onNext: () => void;
  onBack: () => void;
}) => {
  const traits = [
    "Analytical",
    "Creative",
    "Empathetic",
    "Logical",
    "Optimistic",
    "Practical",
    "Strategic",
    "Visionary",
  ];

  const values = [
    "Innovation",
    "Integrity",
    "Growth",
    "Impact",
    "Excellence",
    "Collaboration",
    "Leadership",
    "Learning",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="bg-white p-8 rounded-lg max-w-2xl w-full"
    >
      <h2 className="text-2xl font-bold text-black mb-6">Personality Traits</h2>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Select Your Key Traits
          </label>
          <div className="flex flex-wrap gap-2">
            {traits.map((trait) => (
              <button
                key={trait}
                onClick={() => {
                  const newTraits = data.traits.includes(trait)
                    ? data.traits.filter((t) => t !== trait)
                    : [...data.traits, trait];
                  onUpdate({ ...data, traits: newTraits });
                }}
                className={`px-4 py-2 rounded-full ${
                  data.traits.includes(trait)
                    ? "bg-black text-white"
                    : "bg-gray-200 text-black"
                }`}
              >
                {trait}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Select Your Core Values
          </label>
          <div className="flex flex-wrap gap-2">
            {values.map((value) => (
              <button
                key={value}
                onClick={() => {
                  const newValues = data.values.includes(value)
                    ? data.values.filter((v) => v !== value)
                    : [...data.values, value];
                  onUpdate({ ...data, values: newValues });
                }}
                className={`px-4 py-2 rounded-full ${
                  data.values.includes(value)
                    ? "bg-black text-white"
                    : "bg-gray-200 text-black"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="flex space-x-4 mt-8">
          <motion.button
            onClick={onBack}
            className="w-1/2 px-6 py-3 text-lg font-semibold text-black bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Back
          </motion.button>
          <motion.button
            onClick={onNext}
            className="w-1/2 px-6 py-3 text-lg font-semibold text-white bg-black rounded-full hover:bg-gray-900 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Next
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

const Onboarding: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [persona, setPersona] = useState<PersonaData>({
    communicationStyle: {
      formality: "casual",
      verbosity: "concise",
      tone: "serious",
    },
    languagePatterns: {
      favoriteExpressions: [],
      sentenceLength: "medium",
      vocabulary: "simple",
      useOfJargon: false,
    },
    contentPreferences: {
      topics: [],
      emotionalTone: "neutral",
    },
    personalityTraits: {
      traits: [],
      values: [],
    },
    engagementStyle: {
      responseStyle: "supportive",
      interactionPreference: [],
    },
  });

  const saveOnboardingData = async () => {
    try {
      await chrome.storage.local.set({
        persona,
        onboardingComplete: true,
      });
      onComplete();
    } catch (error) {
      console.error("Error saving persona data:", error);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <WelcomeStep onNext={() => setStep(1)} />;
      case 1:
        return (
          <CommunicationStyleStep
            data={persona.communicationStyle}
            onUpdate={(data) =>
              setPersona({ ...persona, communicationStyle: data })
            }
            onNext={() => setStep(2)}
          />
        );
      case 2:
        return (
          <LanguagePatternsStep
            data={persona.languagePatterns}
            onUpdate={(data) =>
              setPersona({ ...persona, languagePatterns: data })
            }
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        );
      case 3:
        return (
          <ContentPreferencesStep
            data={persona.contentPreferences}
            onUpdate={(data) =>
              setPersona({ ...persona, contentPreferences: data })
            }
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        );
      case 4:
        return (
          <PersonalityTraitsStep
            data={persona.personalityTraits}
            onUpdate={(data) =>
              setPersona({ ...persona, personalityTraits: data })
            }
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
          />
        );
      case 5:
        return (
          <FinalStep
            onComplete={saveOnboardingData}
            onBack={() => setStep(4)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
    </div>
  );
};

const CommunicationStyleStep = ({
  data,
  onUpdate,
  onNext,
}: {
  data: PersonaData["communicationStyle"];
  onUpdate: (data: PersonaData["communicationStyle"]) => void;
  onNext: () => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="w-full max-w-2xl"
    >
      <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-white">
            Communication Style
          </CardTitle>
          <CardDescription className="text-gray-300">
            Choose how you want to interact with your audience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-200">
              How formal should your tweets be?
            </label>
            <div className="flex gap-4">
              {["formal", "casual"].map((option) => (
                <Button
                  key={option}
                  onClick={() =>
                    onUpdate({ ...data, formality: option as any })
                  }
                  variant={data.formality === option ? "default" : "outline"}
                  className={
                    data.formality === option
                      ? "bg-white text-gray-900"
                      : "text-white border-white/20 hover:bg-white/10"
                  }
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-200">
              How detailed should your responses be?
            </label>
            <div className="flex gap-4">
              {["verbose", "concise"].map((option) => (
                <Button
                  key={option}
                  onClick={() =>
                    onUpdate({ ...data, verbosity: option as any })
                  }
                  variant={data.verbosity === option ? "default" : "outline"}
                  className={
                    data.verbosity === option
                      ? "bg-white text-gray-900"
                      : "text-white border-white/20 hover:bg-white/10"
                  }
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-200">
              What tone should your tweets have?
            </label>
            <div className="flex gap-4">
              {["serious", "humorous"].map((option) => (
                <Button
                  key={option}
                  onClick={() => onUpdate({ ...data, tone: option as any })}
                  variant={data.tone === option ? "default" : "outline"}
                  className={
                    data.tone === option
                      ? "bg-white text-gray-900"
                      : "text-white border-white/20 hover:bg-white/10"
                  }
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={onNext}
            size="lg"
            className="bg-white text-gray-900 hover:bg-gray-100"
          >
            Next Step
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

const LanguagePatternsStep = ({
  data,
  onUpdate,
  onNext,
  onBack,
}: {
  data: PersonaData["languagePatterns"];
  onUpdate: (data: PersonaData["languagePatterns"]) => void;
  onNext: () => void;
  onBack: () => void;
}) => {
  const [newExpression, setNewExpression] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="bg-white p-8 rounded-lg max-w-2xl w-full"
    >
      <motion.h2
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-2xl font-bold text-black mb-6"
      >
        Language Patterns
      </motion.h2>
      <div className="space-y-8">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <label className="block text-sm font-medium text-gray-700 mb-4">
            How long should your sentences be?
          </label>
          <div className="flex space-x-4">
            {["short", "medium", "long"].map((option) => (
              <motion.button
                key={option}
                onClick={() =>
                  onUpdate({ ...data, sentenceLength: option as any })
                }
                className={`px-6 py-3 rounded-full text-lg font-medium transition-all transform ${
                  data.sentenceLength === option
                    ? "bg-black text-white scale-105"
                    : "bg-gray-200 text-black hover:bg-gray-300"
                }`}
                whileHover={{
                  scale: data.sentenceLength === option ? 1.05 : 1.02,
                }}
                whileTap={{ scale: 0.98 }}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <label className="block text-sm font-medium text-gray-700 mb-4">
            What type of vocabulary do you prefer?
          </label>
          <div className="flex space-x-4">
            {["simple", "complex"].map((option) => (
              <motion.button
                key={option}
                onClick={() => onUpdate({ ...data, vocabulary: option as any })}
                className={`px-6 py-3 rounded-full text-lg font-medium transition-all transform ${
                  data.vocabulary === option
                    ? "bg-black text-white scale-105"
                    : "bg-gray-200 text-black hover:bg-gray-300"
                }`}
                whileHover={{ scale: data.vocabulary === option ? 1.05 : 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Add your favorite expressions or phrases
          </label>
          <div className="space-y-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newExpression}
                onChange={(e) => setNewExpression(e.target.value)}
                placeholder="Type a phrase..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-black"
              />
              <motion.button
                onClick={() => {
                  if (newExpression.trim()) {
                    onUpdate({
                      ...data,
                      favoriteExpressions: [
                        ...data.favoriteExpressions,
                        newExpression.trim(),
                      ],
                    });
                    setNewExpression("");
                  }
                }}
                className="px-6 py-2 bg-black text-white rounded-full font-medium hover:bg-gray-900"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={!newExpression.trim()}
              >
                Add
              </motion.button>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.favoriteExpressions.map((expression, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="group relative"
                >
                  <span className="px-4 py-2 bg-gray-200 rounded-full inline-block">
                    {expression}
                    <button
                      onClick={() =>
                        onUpdate({
                          ...data,
                          favoriteExpressions: data.favoriteExpressions.filter(
                            (_, i) => i !== index
                          ),
                        })
                      }
                      className="ml-2 text-gray-500 hover:text-black"
                    >
                      ×
                    </button>
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex space-x-4 pt-4"
        >
          <motion.button
            onClick={onBack}
            className="w-1/2 px-6 py-4 text-lg font-semibold text-black bg-gray-200 rounded-full hover:bg-gray-300 transition-all transform"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Back
          </motion.button>
          <motion.button
            onClick={onNext}
            className="w-1/2 px-6 py-4 text-lg font-semibold text-white bg-black rounded-full hover:bg-gray-900 transition-all transform"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Next Step
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};

const FinalStep = ({
  onComplete,
  onBack,
}: {
  onComplete: () => void;
  onBack: () => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="bg-white p-8 rounded-lg max-w-2xl w-full text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="w-20 h-20 mx-auto mb-8 bg-black rounded-full flex items-center justify-center"
      >
        <svg
          className="w-12 h-12 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </motion.div>

      <motion.h2
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold text-black mb-4"
      >
        Your Persona is Ready!
      </motion.h2>

      <motion.p
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-xl text-gray-600 mb-8"
      >
        Time to start engaging with your Twitter audience in your unique style.
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex space-x-4"
      >
        <motion.button
          onClick={onBack}
          className="w-1/2 px-6 py-4 text-lg font-semibold text-black bg-gray-200 rounded-full hover:bg-gray-300 transition-all transform"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Back
        </motion.button>
        <motion.button
          onClick={onComplete}
          className="w-1/2 px-6 py-4 text-lg font-semibold text-white bg-black rounded-full hover:bg-gray-900 transition-all transform"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Get Started
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default Onboarding;
