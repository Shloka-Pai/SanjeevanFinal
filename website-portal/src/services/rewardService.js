const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export const rewardService = {
  grantReward: async ({ email, points }) => {
    const response = await fetch(`${API_BASE_URL}/auth/rewards/grant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, points }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || "Unable to reward user right now.");
    }

    return data;
  },
};
