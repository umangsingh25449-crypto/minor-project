const loanForm = document.getElementById("loanForm");
const result = document.getElementById("result");
const submitButton = loanForm.querySelector('button[type="submit"]');

loanForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    result.textContent = "Submitting your application…";
    result.style.color = "#334155";
    submitButton.disabled = true;

    const payload = {
        name: document.getElementById("name").value.trim(),
        gender: document.getElementById("gender").value,
        married: document.getElementById("married").value,
        education: document.getElementById("education").value,
        selfEmployed: document.getElementById("selfEmployed").value,
        income: document.getElementById("income").value,
        coIncome: document.getElementById("coIncome").value,
        loanAmount: document.getElementById("loanAmount").value,
        duration: document.getElementById("duration").value,
        credit: document.getElementById("credit").value,
        property: document.getElementById("property").value
    };

    try {
        const response = await fetch("/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            const detail = data.fields ? Object.values(data.fields).join(" ") : data.error;
            throw new Error(detail || "Could not submit application.");
        }
        result.style.color = data.prediction === "likely_eligible" ? "green" : "#b45309";
        result.textContent = `${data.message} Reference: ${data.applicationId}`;
    } catch (error) {
        result.style.color = "#b91c1c";
        result.textContent = error.message || "Could not reach the backend. Start the server and try again.";
    } finally {
        submitButton.disabled = false;
    }
});
