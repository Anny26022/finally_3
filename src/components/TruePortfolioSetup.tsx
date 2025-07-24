import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useTruePortfolio } from '../utils/TruePortfolioContext';

interface TruePortfolioSetupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSetupComplete: (userName: string) => void;
  userName: string;
  setUserName: React.Dispatch<React.SetStateAction<string>>;
}

export const TruePortfolioSetup: React.FC<TruePortfolioSetupProps> = ({
  isOpen,
  onOpenChange,
  onSetupComplete,
  userName,
  setUserName
}) => {
  const { yearlyStartingCapitals, setYearlyStartingCapital } = useTruePortfolio();
  const [startingCapital, setStartingCapital] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const handleSetup = () => {
    const amount = parseFloat(startingCapital);
    const year = parseInt(selectedYear);

    if (isNaN(amount) || isNaN(year) || amount <= 0) {
      alert('Please enter a valid amount and year');
      return;
    }

    setYearlyStartingCapital(year, amount);

    // Clear form and close modal
    setStartingCapital('');
    onOpenChange(false);

    // Show success message
    setTimeout(() => {
      alert('✅ Portfolio setup complete! Your True Portfolio system is now active.');
    }, 500);

    onSetupComplete(userName);
  };

  // Check if setup is needed
  const needsSetup = yearlyStartingCapitals.length === 0;

  if (!needsSetup) {
    return null; // Don't show if already set up
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      isDismissable={false}
      hideCloseButton={true}
      classNames={{
        base: "max-w-[90vw] max-h-[90vh] sm:max-w-lg",
        wrapper: "items-center justify-center p-4",
        body: "overflow-y-auto p-0",
        backdrop: "bg-black/60 backdrop-blur-2xl"
      }}
      motionProps={{
        variants: {
          enter: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1]
            }
          },
          exit: {
            opacity: 0,
            scale: 0.95,
            y: 20,
            transition: {
              duration: 0.3,
              ease: [0.16, 1, 0.3, 1]
            }
          }
        },
        initial: { opacity: 0, scale: 0.95, y: 20 }
      }}
    >
      <ModalContent className="bg-background/95 backdrop-blur-xl border border-divider/50 shadow-2xl">
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-3 px-6 py-4 border-b border-divider/50 bg-gradient-to-r from-primary/5 via-secondary/5 to-success/5">
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div>
                  <span className="text-2xl sm:text-3xl font-extrabold uppercase tracking-widest text-center bg-gradient-to-r from-black/80 to-black/40 dark:from-white/90 dark:to-white/40 bg-clip-text text-transparent">
                    NEXUS
                  </span>
                  <p className="text-base sm:text-lg font-medium text-center text-black/60 dark:text-white/60 tracking-wide mt-1">Let's set up your trading journey</p>
                </div>
              </motion.div>
            </ModalHeader>
            <ModalBody className="p-6 space-y-4">
              <motion.div
                className="bg-gradient-to-br from-content1/60 to-content2/40 rounded-2xl p-4 border border-divider/30 shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <motion.div
                    className="p-2 rounded-lg bg-success/10 border border-success/20"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <Icon icon="lucide:user-plus" className="text-success text-lg" />
                  </motion.div>
                  <div>
                    <h4 className="font-semibold text-base text-foreground">Set Your Starting Capital</h4>
                    <p className="text-xs text-default-600">
                      Enter your details for January {selectedYear}
                    </p>
                  </div>
                </div>

                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.8 }}
                >
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.9 }}>
                    <Input
                      label="Your Name"
                      placeholder="Enter your name"
                      value={userName}
                      onValueChange={setUserName}
                      size="sm"
                      variant="bordered"
                      startContent={<Icon icon="lucide:user" className="text-default-400 text-base" />}
                      isRequired
                    />
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 1.0 }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Year"
                        placeholder="e.g., 2025"
                        value={selectedYear}
                        onValueChange={setSelectedYear}
                        type="number"
                        min="2000"
                        max="2099"
                        size="sm"
                        variant="bordered"
                      />
                      <Input
                        label="Starting Capital"
                        placeholder="e.g., 100000"
                        value={startingCapital}
                        onValueChange={setStartingCapital}
                        type="number"
                        min="0"
                        step="1000"
                        startContent={<span className="text-default-400 text-base">₹</span>}
                        size="sm"
                        variant="bordered"
                      />
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            </ModalBody>
            <ModalFooter className="border-t border-divider/50 px-6 py-4 bg-gradient-to-r from-background/50 to-content1/30">
              <motion.div
                className="w-full flex justify-center items-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 1.2 }}
              >
                <Button
                  color="default"
                  onPress={handleSetup}
                  isDisabled={!userName.trim() || !startingCapital || !selectedYear || parseFloat(startingCapital) <= 0 || parseInt(selectedYear) < 2000 || parseInt(selectedYear) > 2099}
                  className="bg-gradient-to-r from-white to-neutral-200 px-3 py-1 text-base font-bold text-neutral-800 rounded-full shadow transition-all duration-300"
                  size="sm"
                  variant="flat"
                  radius="full"
                >
                  Set Up Portfolio
                </Button>
              </motion.div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
