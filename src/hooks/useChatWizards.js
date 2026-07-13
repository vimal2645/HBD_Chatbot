import { useState } from 'react';
import { api } from '../services/api';

export const ADD_BIZ_STEPS = [
  { key: 'phone', promptKey: 'prompt_phone' },
  { key: 'email', promptKey: 'prompt_email' },
  { key: 'otp', promptKey: 'prompt_otp' },
  { key: 'name', promptKey: 'prompt_name' },
  { key: 'category', promptKey: 'prompt_cat' },
  { key: 'address', promptKey: 'prompt_addr' },
  { key: 'city', promptKey: 'prompt_city' },
  { key: 'area', promptKey: 'prompt_area' },
  { key: 'state', promptKey: 'prompt_state' }
];

export const getAddProductSteps = (trans) => [
  { key: 'name', prompt: trans.prod_name || "What is the product name?" },
  { key: 'price', prompt: trans.prod_price || "What is the price?" },
  { key: 'category', prompt: trans.prod_cat || "Product category (e.g. Shoes, Electronics)?" },
  { key: 'description', prompt: trans.prod_desc || "Short description?" },
  { key: 'image_url', prompt: trans.prod_img || "Please upload an image for your product (Optional)." }
];

export const getAddDealSteps = (trans) => [
  { key: 'title', prompt: trans.deal_title || "What is the deal title? (e.g. Holi Midnight Sale)" },
  { key: 'discount_pct', prompt: trans.deal_disc || "Discount percentage? (Only numbers)" },
  { key: 'expiry_date', prompt: trans.deal_expiry || "Valid until? (e.g. 2026-04-30)" },
  { key: 'description', prompt: trans.deal_desc || "Tell us more about this offer." }
];

export const CATEGORY_DYNAMIC_FIELDS = {
  restaurant: [
    { key: 'cuisine', prompt: "What type of cuisine do you serve? (e.g. Indian, Chinese, Italian)" },
    { key: 'seating_capacity', prompt: "What is your seating capacity? (e.g. 50)" }
  ],
  gym: [
    { key: 'membership_rates', prompt: "What are your membership rates? (e.g. 1500/month)" },
    { key: 'has_personal_trainers', prompt: "Do you have personal trainers? (Yes/No)" }
  ],
  hotel: [
    { key: 'room_types', prompt: "What room types do you offer? (e.g. Deluxe, Suite)" },
    { key: 'has_swimming_pool', prompt: "Do you have a swimming pool? (Yes/No)" }
  ]
};

export function useChatWizards({
  session,
  currentLanguage,
  setLocalMessages,
  addThinking,
  removeThinking,
  setSession,
  setIsLoggedIn,
  setQuickActionsView,
  flowMode,
  setFlowMode,
  wizardStep,
  setWizardStep,
  wizardData,
  setWizardData,
  pendingUpdateField,
  setPendingUpdateField,
  selectedBusiness
}) {
  const [wizardStepsList, setWizardStepsList] = useState(ADD_BIZ_STEPS);

  const formatFieldName = (field) =>
    field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const finalizeProduct = async (data) => {
    addThinking();
    const finalData = { 
      ...data, 
      business_id: selectedBusiness?.global_business_id 
    };
    try {
      console.log("Selected Business:", selectedBusiness);
      console.log("Sending:", finalData);
      const res = await api.addProduct(finalData);
      removeThinking();
      setFlowMode('QUERY');
      if (res.success) {
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "✅ Product added successfully!" }]);
      } else {
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "❌ Error: " + (res.detail || "Could not add product.") }]);
      }
    } catch (err) {
      removeThinking();
      setFlowMode('QUERY');
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "❌ Error: " + err.message }]);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    addThinking();
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.uploadImage(formData);

      removeThinking();
      if (res.success) {
        const currentData = { ...wizardData, image_url: res.url };
        setWizardData(currentData);
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: 'Image uploaded successfully ✅' }]);
        
        // Finalize (last step)
        finalizeProduct(currentData);
      } else {
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '❌ Upload failed. Please try again.' }]);
      }
    } catch (err) {
      removeThinking();
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '❌ Upload error.' }]);
    }
  };

  const handleImageSkip = () => {
    setLocalMessages(prev => [...prev, { id: Date.now(), role: 'user', type: 'text', content: 'Skipped image ⏭️' }]);
    finalizeProduct({...wizardData, image_url: ""});
  };

  const handleWizardSend = async (text, trans) => {
    const lang = currentLanguage || 'en';
    const cleanText = text.trim().toLowerCase();
    // // Check for Resume Command
    // if (cleanText === 'resume') {
    //   const saved = localStorage.getItem('resumable_wizard');
    //   if (saved) {
    //     try {
    //       const parsed = JSON.parse(saved);
    //       setFlowMode(parsed.flowMode);
    //       setWizardStep(parsed.wizardStep);
    //       setWizardData(parsed.wizardData);
    //       if (parsed.wizardStepsList) {
    //         setWizardStepsList(parsed.wizardStepsList);
    //       }
    //       setLocalMessages(prev => [
    //         ...prev,
    //         { id: Date.now(), role: 'bot', type: 'text', content: "🔄 Resuming onboarding wizard. Let's continue!" },
    //         { id: Date.now() + 1, role: 'bot', type: 'text', content: parsed.currentPrompt }
    //       ]);
    //       return true;
    //     } catch (e) {
    //       console.error("Resume error:", e);
    //     }
    //   }
    //   setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "No paused wizard session was found." }]);
    //   return true;
    // }

    // // Cancel / Exit state saving
    // if (cleanText === 'cancel' || cleanText === 'exit' || cleanText === 'quit' || cleanText === 'reset') {
    //   if (flowMode === 'ADD_WIZARD' || flowMode === 'ADD_PRODUCT' || flowMode === 'ADD_DEAL') {
    //     const activeSteps = flowMode === 'ADD_WIZARD' ? wizardStepsList : (flowMode === 'ADD_PRODUCT' ? getAddProductSteps(trans) : getAddDealSteps(trans));
    //     const currentPrompt = activeSteps[wizardStep]?.promptKey ? (trans[activeSteps[wizardStep].promptKey] || activeSteps[wizardStep].promptKey) : activeSteps[wizardStep]?.prompt;
    //     localStorage.setItem('resumable_wizard', JSON.stringify({
    //       flowMode,
    //       wizardStep,
    //       wizardData,
    //       wizardStepsList: flowMode === 'ADD_WIZARD' ? wizardStepsList : null,
    //       currentPrompt
    //     }));
    //   }
    //   setFlowMode('QUERY');
    //   setWizardStep(0);
    //   setWizardData({});
    //   setPendingUpdateField(null);
    //   removeThinking();
    //   setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.wizard_canceled || "Wizard paused. You can resume at any time by typing 'resume'." }]);
    //   return true;
    // }

    if (flowMode === 'UPDATE_VALUE') {
      if (pendingUpdateField === 'phone_number') {
        if (!/^\d{10}$/.test(text.replace(/\s+/g, ''))) {
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.invalid_phone }]);
          return true;
        }
      }
      if (['address', 'name', 'city', 'state', 'area'].includes(pendingUpdateField)) {
        if (/^\d+$/.test(text.trim())) {
          removeThinking();
          const fieldLabel = pendingUpdateField.replace('_', ' ').toUpperCase();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${fieldLabel} ${trans.no_numbers}` }]);
          return true;
        }
      }

      try {
        const res = await api.updateBusiness(selectedBusiness?.global_business_id || session.businessId, pendingUpdateField, text);
        removeThinking();
        
        if (res.success) {
          const fieldLabel = pendingUpdateField.replace('_', ' ');
          const successMsg = lang === 'hi' 
            ? `✅ ${fieldLabel.toUpperCase()} सफलतापूर्वक अपडेट किया गया!` 
            : `✅ ${formatFieldName(fieldLabel)} updated successfully!`;
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: successMsg }]);
        } else {
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${res.message || 'Error'}` }]);
        }
      } catch (err) {
        removeThinking();
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${err.message}` }]);
      }
      
      setFlowMode('QUERY');
      setPendingUpdateField(null);
      return true;
    }

    if (flowMode === 'SEARCH_NAME') {
      try {
        const results = await api.searchByName(text);
        removeThinking();
        if (results.length) {
          const suggestions = results.map(b => ({ title: b.business_name, reason: `${b.area}, ${b.city}`, action: 'claim_business', payload: b }));
          setLocalMessages(prev => [
            ...prev, 
            { id: Date.now(), role: 'bot', type: 'text', content: trans.found_intro }, 
            { id: Date.now() + 1, role: 'bot', type: 'suggestions', content: suggestions }
          ]);
        } else {
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.none_found }]);
        }
      } catch (err) {
        removeThinking();
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${err.message}` }]);
      }
      setFlowMode('QUERY');
      return true;
    }

    if (flowMode === 'SEARCH_ADDR') {
      try {
        const results = await api.searchByAddress(text);
        removeThinking();
        if (results.length) {
          const suggestions = results.map(b => ({ title: b.business_name, reason: b.area, action: 'claim_business', payload: b }));
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'suggestions', content: suggestions }]);
        } else {
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.none_nearby }]);
        }
      } catch (err) {
        removeThinking();
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${err.message}` }]);
      }
      setFlowMode('QUERY');
      return true;
    }

    if (flowMode === 'ADD_WIZARD') {
      const currentStep = wizardStepsList[wizardStep];
      if (currentStep.key === 'phone') {
        if (!/^\d{10}$/.test(text.replace(/\s+/g, ''))) {
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.invalid_phone }]);
          return true;
        }
      }
      if (currentStep.key === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.invalid_email }]);
          return true;
        }
      }
      if (currentStep.key === 'address' || currentStep.key === 'name') {
        if (/^\d+$/.test(text.trim())) {
          removeThinking();
          const fieldLabel = currentStep.key === 'name' ? trans.btn_name : trans.btn_address;
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${fieldLabel} ${trans.no_numbers}` }]);
          return true;
        }
      }

      // Splice dynamic category specific fields if we just submitted the category
      let updatedSteps = [...wizardStepsList];
      if (currentStep.key === 'category') {
        const catKey = text.trim().toLowerCase();
        let dynamicFields = CATEGORY_DYNAMIC_FIELDS[catKey] || [];
        if (dynamicFields.length === 0) {
          for (const k of Object.keys(CATEGORY_DYNAMIC_FIELDS)) {
            if (catKey.includes(k)) {
              dynamicFields = CATEGORY_DYNAMIC_FIELDS[k];
              break;
            }
          }
        }
        
        // Filter out previously injected dynamic fields
        const staticKeys = ['phone', 'email', 'otp', 'name', 'category', 'address', 'city', 'area', 'state'];
        updatedSteps = updatedSteps.filter(s => staticKeys.includes(s.key));
        
        const catIndex = updatedSteps.findIndex(s => s.key === 'category');
        if (catIndex !== -1 && dynamicFields.length > 0) {
          updatedSteps.splice(catIndex + 1, 0, ...dynamicFields);
          setWizardStepsList(updatedSteps);
        }
      }

      const nextStep = wizardStep + 1;
      const updatedWizardData = { ...wizardData, [currentStep.key]: text };
      setWizardData(updatedWizardData);

      try {
        if (currentStep.key === 'email') {
          const res = await api.sendEmailOtp(text, "registration");
          if (!res.success) {
            setLocalMessages(prev => [...prev, {
              id: Date.now(),
              role: 'bot',
              type: 'text',
              content: `❌ ${res.message}`
            }]);
            return true;
          }
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'otp', content: '📩 OTP sent successfully! Please enter the verification code sent to your email. If not recieved make sure you entered the right email or try resend OTP.' }]);

        } else if (currentStep.key === 'otp') {
          if (text.toLowerCase() === 'resend') {
            await api.sendEmailOtp(wizardData.email, "registration");
            setLocalMessages(prev => [...prev, {
              id: Date.now(),
              role: 'bot',
              type: 'otp',
              content: '📩 Verification code has been resent to your email. Please enter the new code:'
            }]);
            removeThinking();
            return true;
          }
          try {
            const res = await api.verifyEmailOtp(wizardData.email, text);
            if (!res.success) {
              removeThinking();
              setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: '❌ Invalid OTP. Try again.' }]);
              return true;
            }
            if (res.token) {
              localStorage.setItem('token', res.token);
              localStorage.setItem('isLoggedIn', 'true');
              if (res.user) {
                localStorage.setItem('session', JSON.stringify(res.user));
                setSession?.(res.user);
                setIsLoggedIn?.(true);
              } else {
                const fbUser = { id: 0, email: wizardData.email, role: 'owner' };
                localStorage.setItem('session', JSON.stringify(fbUser));
                setSession?.(fbUser);
                setIsLoggedIn?.(true);
              }
            }
          } catch (verifyErr) {
            removeThinking();
            setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${verifyErr.message || 'Verification failed. Try again.'}` }]);
            return true;
          }
        }

        if (nextStep < updatedSteps.length) {
          setWizardStep(nextStep);
          removeThinking();
          const nextBizStep = updatedSteps[nextStep];
          const nextPrompt = nextBizStep.promptKey ? (trans[nextBizStep.promptKey] || nextBizStep.promptKey) : nextBizStep.prompt;

          if (nextBizStep.key !== 'otp') {
            setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: nextPrompt }]);
          }
        } else {
          // Render preview card instead of finalizing immediately
          removeThinking();
          setLocalMessages(prev => [
            ...prev,
            { id: Date.now(), role: 'bot', type: 'business_preview', content: updatedWizardData }
          ]);
          setWizardStep(updatedSteps.length); // Stop progression until confirm/cancel
        }
      } catch (err) {
        removeThinking();
        setFlowMode('QUERY');
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${err.message}` }]);
      }
      return true;
    }

    if (flowMode === 'ADD_PRODUCT') {
      const ADD_PRODUCT_STEPS = getAddProductSteps(trans);
      const currentStep = ADD_PRODUCT_STEPS[wizardStep];
      let cleanedValue = text;
      
      if (currentStep.key === 'price') {
        const match = text.replace(/,/g, '').match(/\d+(\.\d+)?/);
        if (!match) {
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "❌ Please enter a valid price (e.g. 23000 or 23000.50)." }]);
          return true;
        }
        cleanedValue = parseFloat(match[0]);
      }

      const nextStep = wizardStep + 1;
      const updatedWizardData = { ...wizardData, [currentStep.key]: cleanedValue };
      
      if (nextStep < ADD_PRODUCT_STEPS.length) {
        setWizardData(updatedWizardData);
        setWizardStep(nextStep);
        removeThinking();
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: ADD_PRODUCT_STEPS[nextStep].prompt }]);
      } else {
        finalizeProduct(updatedWizardData);
      }
      return true;
    }

    if (flowMode === 'ADD_DEAL') {
      const ADD_DEAL_STEPS = getAddDealSteps(trans);
      const currentStep = ADD_DEAL_STEPS[wizardStep];
      let cleanedValue = text;

      if (currentStep.key === 'discount_pct') {
        const numeric = text.replace(/[^0-9]/g, '');
        if (!numeric || isNaN(parseInt(numeric))) {
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "❌ Please enter a valid percentage (numbers only)." }]);
          return true;
        }
        cleanedValue = parseInt(numeric);
      }

      const nextStep = wizardStep + 1;
      const updatedWizardData = { ...wizardData, [currentStep.key]: cleanedValue };

      try {
        if (nextStep < ADD_DEAL_STEPS.length) {
          setWizardData(updatedWizardData);
          setWizardStep(nextStep);
          removeThinking();
          setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: ADD_DEAL_STEPS[nextStep].prompt }]);
        } else {
          const finalData = { 
            ...updatedWizardData,
            business_id: selectedBusiness?.global_business_id
          };
          console.log("Submitting Deal:", JSON.stringify(finalData));
          const res = await api.addDeal(finalData);
          removeThinking();
          setFlowMode('QUERY');
          if (res.success) {
            setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "✅ Deal posted successfully!" }]);
          } else {
            setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: "❌ Error posting deal." }]);
          }
        }
      } catch (err) {
        removeThinking();
        setFlowMode('QUERY');
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${err.message}` }]);
      }
      return true;
    }

    return false; // not in a wizard flow
  };

  const confirmBusinessOnboarding = async (trans) => {
    addThinking();
    const finalData = { 
      ...wizardData,
      language: currentLanguage || 'en',
      email: wizardData.email || session.email || "",
      phone: wizardData.phone || session.phone || ""
    };
    try {
      const res = await api.addBusiness(finalData);
      removeThinking();
      setFlowMode('QUERY');
      if (res.success) {
        const updatedSession = {
          ...session,
          type: 'BUSINESS',
          businessId: res.id,
          businessName: finalData.name,
          city: finalData.city
        }
        setSession(updatedSession);
        localStorage.setItem("session", JSON.stringify(updatedSession));;
        
        setIsLoggedIn?.(true);
        setQuickActionsView('main');
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.business_added }]);
        localStorage.removeItem('resumable_wizard'); // Clear resume state on completion!
      } else {
        setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${res.message || 'Error'}` }]);
      }
    } catch (err) {
      removeThinking();
      setFlowMode('QUERY');
      setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: `❌ ${err.message}` }]);
    }
  };

  const cancelBusinessOnboarding = (trans) => {
    setFlowMode('QUERY');
    setWizardStep(0);
    setWizardData({});
    setPendingUpdateField(null);
    removeThinking();
    localStorage.removeItem('resumable_wizard'); // Clear resume state on cancel!
    setLocalMessages(prev => [...prev, { id: Date.now(), role: 'bot', type: 'text', content: trans.wizard_canceled || "Registration canceled." }]);
  };

  return {
    flowMode,
    setFlowMode,
    wizardStep,
    setWizardStep,
    wizardData,
    setWizardData,
    pendingUpdateField,
    setPendingUpdateField,
    handleImageUpload,
    finalizeProduct,
    handleImageSkip,
    handleWizardSend,
    confirmBusinessOnboarding,
    cancelBusinessOnboarding,
    wizardStepsList,
    setWizardStepsList
  };
}
