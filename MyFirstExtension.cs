using Ghost;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace HelloGhostPlugin
{
    public class MyFirstExtension : IEmbeddedViewExtension
    {
        private MyFirstHub myFirstHub;

        public bool IsClickThrough => false;

        public HubBase Hub => myFirstHub;

        public void Dispose()
        {
        }

        public FrameworkElement GetView()
        {
            return myFirstHub.Button;
        }

        public void Initialize(IExtensionConfig config)
        {
            myFirstHub = new MyFirstHub();
        }

        public void OnConnected()
        {
        }

        public void OnDisconnect()
        {
        }
    }

    public class MyFirstHub : HubBase
    {
        private Button button;

        public Button Button => button;

        public MyFirstHub()
        {
            button = new Button()
            {
                Content = "I'm a wpf button, click me.",
                FontSize = 18,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Colors.Orange),
                Background = new SolidColorBrush(Colors.White),
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };
            button.Click += Button_Click;
        }

        private void Button_Click(object sender, RoutedEventArgs e)
        {
            this.Client.changeText("Hello");
        }

        public void ChangeText(string text)
        {
            button.Content = text;
        }
    }
}
