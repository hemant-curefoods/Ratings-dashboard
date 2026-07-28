export async function fetchGoogleReviews() {
  console.log("[REVIEWS] Returning dummy data...");
  return [
    {
      id: "dummy_1",
      name: "accounts/123/locations/456/reviews/dummy_1",
      store_name: "Sample Store",
      brand: "Sample Brand",
      reviewer_name: "Rahul M.",
      star_rating: 2,
      review_text: "The biryani lacked salt and the pieces were too bony. Disappointed with today's order.",
      review_date: new Date().toISOString(),
      status: "pending",
    },
    {
      id: "dummy_2",
      name: "accounts/123/locations/456/reviews/dummy_2",
      store_name: "Sample Store",
      brand: "Sample Brand",
      reviewer_name: "Sarah S.",
      star_rating: 5,
      review_text: "Absolutely delicious! The spices were perfect and the meat was so tender. Will order again.",
      review_date: new Date(Date.now() - 86400000).toISOString(),
      status: "pending",
    }
  ];
}
