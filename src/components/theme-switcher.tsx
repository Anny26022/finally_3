import React from "react";
import { Switch, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useTheme } from "@heroui/use-theme";

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Tooltip
      content={`Switch to ${isDark ? "light" : "dark"} mode`}
      placement="bottom"
      className="animate-fade-in"
    >
      <div className="flex items-center gap-2 p-2 rounded-lg transition-all duration-300 ease-in-out hover:bg-foreground-100/50">
        <Icon
          icon={isDark ? "lucide:moon" : "lucide:sun"}
          className={`text-lg transition-all duration-300 transform ${
            isDark
              ? "text-primary-400 rotate-0"
              : "text-warning-400 rotate-90"
          }`}
        />
        <Switch
          isSelected={isDark}
          onValueChange={handleToggle}
          size="sm"
          className="mx-0"
          classNames={{
            wrapper: [
              "group-data-[selected=true]:bg-gradient-to-r",
              isDark
                ? "group-data-[selected=true]:from-gray-800 group-data-[selected=true]:to-black"
                : "group-data-[selected=true]:from-orange-400 group-data-[selected=true]:to-orange-500",
              "group-data-[selected=false]:bg-gradient-to-r group-data-[selected=false]:from-gray-200 group-data-[selected=false]:to-gray-300",
              "dark:group-data-[selected=false]:from-gray-600 dark:group-data-[selected=false]:to-gray-700",
              "shadow-lg hover:shadow-xl transition-all duration-300 ease-out",
              "border border-white/20 backdrop-blur-sm",
              "hover:scale-105 active:scale-95",
              "relative overflow-hidden"
            ],
            thumb: [
              "bg-white shadow-lg",
              "group-data-[selected=true]:shadow-xl",
              isDark
                ? "group-data-[selected=true]:shadow-gray-900/40"
                : "group-data-[selected=true]:shadow-orange/30",
              "transition-all duration-300 ease-out",
              "border border-white/50",
              "hover:scale-110",
              "relative z-10"
            ]
          }}
        />
      </div>
    </Tooltip>
  );
};